"""
YouTube Data API integration service.
Provides video search, metadata retrieval, and content import capabilities.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import aiohttp
import json
from urllib.parse import quote_plus, parse_qs, urlparse
from dataclasses import dataclass
from cachetools import TTLCache

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

@dataclass
class YouTubeVideo:
    """YouTube video data structure."""
    video_id: str
    title: str
    description: str
    channel_title: str
    channel_id: str
    published_at: datetime
    duration: str
    view_count: int
    like_count: Optional[int]
    comment_count: Optional[int]
    thumbnail_url: str
    tags: List[str]
    category_id: str
    default_language: Optional[str]
    captions_available: bool
    
class YouTubeAPIService:
    """YouTube Data API service with rate limiting and caching."""
    
    BASE_URL = "https://www.googleapis.com/youtube/v3"
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize YouTube API service."""
        self.api_key = api_key or getattr(settings, 'youtube_api_key', None)
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Rate limiting (YouTube quota: 10,000 units/day)
        self._daily_quota_used = 0
        self._last_reset = datetime.now()
        self._rate_limit_cache = TTLCache(maxsize=1000, ttl=60)  # 1 minute cache
        
        # Results cache (5 minute TTL)
        self._results_cache = TTLCache(maxsize=500, ttl=300)
        
        if not self.api_key:
            logger.warning("YouTube API key not configured. YouTube features will be disabled.")
    
    async def __aenter__(self):
        """Async context manager entry."""
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    def _check_quota(self, cost: int = 1) -> bool:
        """Check if we have quota remaining."""
        now = datetime.now()
        if (now - self._last_reset).days >= 1:
            self._daily_quota_used = 0
            self._last_reset = now
        
        if self._daily_quota_used + cost > 9000:  # Leave 1000 units buffer
            logger.warning("YouTube API quota nearly exhausted")
            return False
        
        self._daily_quota_used += cost
        return True
    
    def _get_cache_key(self, endpoint: str, params: Dict[str, Any]) -> str:
        """Generate cache key from endpoint and parameters."""
        sorted_params = sorted(params.items())
        return f"{endpoint}:{hash(str(sorted_params))}"
    
    async def _make_request(self, endpoint: str, params: Dict[str, Any], quota_cost: int = 1) -> Optional[Dict[str, Any]]:
        """Make authenticated request to YouTube API with caching and rate limiting."""
        if not self.api_key:
            logger.error("YouTube API key not configured")
            return None
        
        if not self._check_quota(quota_cost):
            logger.error("YouTube API quota exhausted")
            return None
        
        # Check cache first
        cache_key = self._get_cache_key(endpoint, params)
        if cache_key in self._results_cache:
            logger.debug(f"Cache hit for {endpoint}")
            return self._results_cache[cache_key]
        
        # Rate limiting check
        if cache_key in self._rate_limit_cache:
            logger.debug(f"Rate limit hit for {endpoint}")
            await asyncio.sleep(1)
        
        url = f"{self.BASE_URL}/{endpoint}"
        params["key"] = self.api_key
        
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
            
            async with self.session.get(url, params=params, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    self._results_cache[cache_key] = data
                    self._rate_limit_cache[cache_key] = True
                    return data
                elif response.status == 403:
                    error_data = await response.json()
                    if "quotaExceeded" in str(error_data):
                        logger.error("YouTube API quota exceeded")
                        self._daily_quota_used = 10000  # Mark as exhausted
                    else:
                        logger.error(f"YouTube API access denied: {error_data}")
                elif response.status == 429:
                    logger.warning("YouTube API rate limit hit, waiting...")
                    await asyncio.sleep(5)
                    return await self._make_request(endpoint, params, quota_cost)
                else:
                    logger.error(f"YouTube API error {response.status}: {await response.text()}")
                    
        except asyncio.TimeoutError:
            logger.error("YouTube API request timeout")
        except Exception as e:
            logger.error(f"YouTube API request failed: {e}")
        
        return None
    
    async def search_videos(
        self, 
        query: str, 
        max_results: int = 10,
        published_after: Optional[datetime] = None,
        published_before: Optional[datetime] = None,
        channel_id: Optional[str] = None,
        video_duration: Optional[str] = None,  # short, medium, long
        order: str = "relevance"  # date, rating, relevance, title, viewCount
    ) -> List[YouTubeVideo]:
        """Search for YouTube videos."""
        if not self.api_key:
            return []
        
        params = {
            "part": "snippet",
            "q": query,
            "type": "video",
            "maxResults": min(max_results, 50),  # API limit
            "order": order,
            "safeSearch": "strict"
        }
        
        if published_after:
            params["publishedAfter"] = published_after.isoformat() + "Z"
        if published_before:
            params["publishedBefore"] = published_before.isoformat() + "Z"
        if channel_id:
            params["channelId"] = channel_id
        if video_duration:
            params["videoDuration"] = video_duration
        
        data = await self._make_request("search", params, quota_cost=100)
        if not data or "items" not in data:
            return []
        
        # Get detailed video information
        video_ids = [item["id"]["videoId"] for item in data["items"]]
        video_details = await self._get_video_details(video_ids)
        
        videos = []
        for item in data["items"]:
            video_id = item["id"]["videoId"]
            snippet = item["snippet"]
            details = video_details.get(video_id, {})
            
            video = YouTubeVideo(
                video_id=video_id,
                title=snippet.get("title", ""),
                description=snippet.get("description", ""),
                channel_title=snippet.get("channelTitle", ""),
                channel_id=snippet.get("channelId", ""),
                published_at=datetime.fromisoformat(snippet["publishedAt"].replace("Z", "+00:00")),
                duration=details.get("duration", ""),
                view_count=int(details.get("viewCount", 0)),
                like_count=details.get("likeCount"),
                comment_count=details.get("commentCount"),
                thumbnail_url=snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
                tags=details.get("tags", []),
                category_id=details.get("categoryId", ""),
                default_language=details.get("defaultLanguage"),
                captions_available=details.get("captionsAvailable", False)
            )
            videos.append(video)
        
        return videos
    
    async def _get_video_details(self, video_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """Get detailed information for multiple videos."""
        if not video_ids:
            return {}
        
        # API allows up to 50 IDs per request
        chunks = [video_ids[i:i+50] for i in range(0, len(video_ids), 50)]
        all_details = {}
        
        for chunk in chunks:
            params = {
                "part": "contentDetails,statistics,snippet,status",
                "id": ",".join(chunk)
            }
            
            data = await self._make_request("videos", params, quota_cost=1)
            if data and "items" in data:
                for item in data["items"]:
                    video_id = item["id"]
                    content_details = item.get("contentDetails", {})
                    statistics = item.get("statistics", {})
                    snippet = item.get("snippet", {})
                    
                    all_details[video_id] = {
                        "duration": content_details.get("duration", ""),
                        "viewCount": statistics.get("viewCount", "0"),
                        "likeCount": int(statistics.get("likeCount", 0)) if statistics.get("likeCount") else None,
                        "commentCount": int(statistics.get("commentCount", 0)) if statistics.get("commentCount") else None,
                        "tags": snippet.get("tags", []),
                        "categoryId": snippet.get("categoryId", ""),
                        "defaultLanguage": snippet.get("defaultLanguage"),
                        "captionsAvailable": content_details.get("caption") == "true"
                    }
        
        return all_details
    
    async def get_video_by_id(self, video_id: str) -> Optional[YouTubeVideo]:
        """Get detailed information for a specific video."""
        details = await self._get_video_details([video_id])
        if not details.get(video_id):
            return None
        
        # Get basic snippet info
        params = {
            "part": "snippet",
            "id": video_id
        }
        
        data = await self._make_request("videos", params, quota_cost=1)
        if not data or "items" not in data or not data["items"]:
            return None
        
        snippet = data["items"][0]["snippet"]
        video_details = details[video_id]
        
        return YouTubeVideo(
            video_id=video_id,
            title=snippet.get("title", ""),
            description=snippet.get("description", ""),
            channel_title=snippet.get("channelTitle", ""),
            channel_id=snippet.get("channelId", ""),
            published_at=datetime.fromisoformat(snippet["publishedAt"].replace("Z", "+00:00")),
            duration=video_details.get("duration", ""),
            view_count=int(video_details.get("viewCount", 0)),
            like_count=video_details.get("likeCount"),
            comment_count=video_details.get("commentCount"),
            thumbnail_url=snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
            tags=video_details.get("tags", []),
            category_id=video_details.get("categoryId", ""),
            default_language=video_details.get("defaultLanguage"),
            captions_available=video_details.get("captionsAvailable", False)
        )
    
    async def get_video_captions(self, video_id: str, language: str = "en") -> Optional[str]:
        """Get video captions/transcript."""
        try:
            # First check if captions are available
            video = await self.get_video_by_id(video_id)
            if not video or not video.captions_available:
                return None
            
            # Get caption tracks
            params = {
                "part": "snippet",
                "videoId": video_id
            }
            
            data = await self._make_request("captions", params, quota_cost=50)
            if not data or "items" not in data:
                return None
            
            # Find the best caption track
            caption_id = None
            for item in data["items"]:
                snippet = item["snippet"]
                if snippet.get("language") == language:
                    caption_id = item["id"]
                    break
            
            if not caption_id and data["items"]:
                # Fallback to first available caption
                caption_id = data["items"][0]["id"]
            
            if not caption_id:
                return None
            
            # Download caption content
            # Note: This requires OAuth authentication for private captions
            # For public captions, we can use youtube-transcript-api as fallback
            return await self._download_caption_content(video_id, language)
            
        except Exception as e:
            logger.error(f"Failed to get captions for video {video_id}: {e}")
            return None
    
    async def _download_caption_content(self, video_id: str, language: str = "en") -> Optional[str]:
        """Download caption content using youtube-transcript-api."""
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            
            # Run in thread pool since this is a sync library
            loop = asyncio.get_event_loop()
            transcript = await loop.run_in_executor(
                None, 
                YouTubeTranscriptApi.get_transcript, 
                video_id,
                [language, 'en']  # Fallback to English
            )
            
            # Combine transcript segments
            text = " ".join([segment['text'] for segment in transcript])
            return text
            
        except Exception as e:
            logger.error(f"Failed to download transcript for video {video_id}: {e}")
            return None
    
    async def get_channel_info(self, channel_id: str) -> Optional[Dict[str, Any]]:
        """Get channel information."""
        params = {
            "part": "snippet,statistics,contentDetails",
            "id": channel_id
        }
        
        data = await self._make_request("channels", params, quota_cost=1)
        if not data or "items" not in data or not data["items"]:
            return None
        
        item = data["items"][0]
        snippet = item.get("snippet", {})
        statistics = item.get("statistics", {})
        
        return {
            "id": channel_id,
            "title": snippet.get("title", ""),
            "description": snippet.get("description", ""),
            "thumbnail_url": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
            "subscriber_count": int(statistics.get("subscriberCount", 0)),
            "video_count": int(statistics.get("videoCount", 0)),
            "view_count": int(statistics.get("viewCount", 0)),
            "published_at": snippet.get("publishedAt", "")
        }
    
    async def get_trending_videos(self, region_code: str = "US", category_id: Optional[str] = None) -> List[YouTubeVideo]:
        """Get trending videos."""
        params = {
            "part": "snippet",
            "chart": "mostPopular",
            "regionCode": region_code,
            "maxResults": 50
        }
        
        if category_id:
            params["videoCategoryId"] = category_id
        
        data = await self._make_request("videos", params, quota_cost=1)
        if not data or "items" not in data:
            return []
        
        # Convert to YouTubeVideo objects
        video_ids = [item["id"] for item in data["items"]]
        video_details = await self._get_video_details(video_ids)
        
        videos = []
        for item in data["items"]:
            video_id = item["id"]
            snippet = item["snippet"]
            details = video_details.get(video_id, {})
            
            video = YouTubeVideo(
                video_id=video_id,
                title=snippet.get("title", ""),
                description=snippet.get("description", ""),
                channel_title=snippet.get("channelTitle", ""),
                channel_id=snippet.get("channelId", ""),
                published_at=datetime.fromisoformat(snippet["publishedAt"].replace("Z", "+00:00")),
                duration=details.get("duration", ""),
                view_count=int(details.get("viewCount", 0)),
                like_count=details.get("likeCount"),
                comment_count=details.get("commentCount"),
                thumbnail_url=snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
                tags=details.get("tags", []),
                category_id=details.get("categoryId", ""),
                default_language=details.get("defaultLanguage"),
                captions_available=details.get("captionsAvailable", False)
            )
            videos.append(video)
        
        return videos
    
    def extract_video_id(self, url: str) -> Optional[str]:
        """Extract YouTube video ID from various URL formats."""
        try:
            parsed_url = urlparse(url)
            
            if parsed_url.hostname in ['youtu.be']:
                return parsed_url.path[1:]
            
            if parsed_url.hostname in ['www.youtube.com', 'youtube.com', 'm.youtube.com']:
                if parsed_url.path == '/watch':
                    query_params = parse_qs(parsed_url.query)
                    return query_params.get('v', [None])[0]
                elif parsed_url.path.startswith('/embed/'):
                    return parsed_url.path.split('/')[2]
                elif parsed_url.path.startswith('/v/'):
                    return parsed_url.path.split('/')[2]
            
        except Exception as e:
            logger.error(f"Failed to extract video ID from URL {url}: {e}")
        
        return None
    
    async def get_quota_usage(self) -> Dict[str, Any]:
        """Get current quota usage information."""
        return {
            "daily_quota_used": self._daily_quota_used,
            "daily_quota_limit": 10000,
            "quota_remaining": 10000 - self._daily_quota_used,
            "last_reset": self._last_reset.isoformat(),
            "cache_size": len(self._results_cache),
            "rate_limit_cache_size": len(self._rate_limit_cache)
        }