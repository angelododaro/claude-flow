"""
Social Media API integration service.
Provides unified interface for Twitter, Reddit, and other social platforms.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
import aiohttp
import json
from dataclasses import dataclass
from cachetools import TTLCache
import re
from urllib.parse import quote_plus

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

@dataclass
class SocialPost:
    """Universal social media post data structure."""
    post_id: str
    platform: str  # twitter, reddit, instagram, etc.
    author: str
    author_id: str
    content: str
    created_at: datetime
    url: str
    engagement: Dict[str, int]  # likes, shares, comments, etc.
    media_urls: List[str]
    hashtags: List[str]
    mentions: List[str]
    metadata: Dict[str, Any]

class SocialMediaService:
    """Unified social media API service with rate limiting and caching."""
    
    def __init__(self):
        """Initialize social media service."""
        self.session: Optional[aiohttp.ClientSession] = None
        
        # API credentials
        self.twitter_bearer_token = getattr(settings, 'twitter_bearer_token', None)
        self.reddit_client_id = getattr(settings, 'reddit_client_id', None)
        self.reddit_client_secret = getattr(settings, 'reddit_client_secret', None)
        
        # Rate limiting caches
        self._rate_limit_cache = TTLCache(maxsize=1000, ttl=60)
        self._results_cache = TTLCache(maxsize=1000, ttl=300)  # 5 minute cache
        
        # Platform-specific rate limits
        self._twitter_requests = 0
        self._twitter_reset_time = datetime.now()
        self._reddit_requests = 0
        self._reddit_reset_time = datetime.now()
        
        logger.info("Social Media Service initialized")
    
    async def __aenter__(self):
        """Async context manager entry."""
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    def _check_twitter_rate_limit(self) -> bool:
        """Check Twitter API v2 rate limits (300 requests per 15 minutes)."""
        now = datetime.now()
        if (now - self._twitter_reset_time).seconds >= 900:  # 15 minutes
            self._twitter_requests = 0
            self._twitter_reset_time = now
        
        if self._twitter_requests >= 280:  # Leave buffer
            logger.warning("Twitter API rate limit nearly reached")
            return False
        
        self._twitter_requests += 1
        return True
    
    def _check_reddit_rate_limit(self) -> bool:
        """Check Reddit API rate limits (60 requests per minute)."""
        now = datetime.now()
        if (now - self._reddit_reset_time).seconds >= 60:
            self._reddit_requests = 0
            self._reddit_reset_time = now
        
        if self._reddit_requests >= 55:  # Leave buffer
            logger.warning("Reddit API rate limit nearly reached")
            return False
        
        self._reddit_requests += 1
        return True
    
    async def search_twitter(
        self, 
        query: str, 
        max_results: int = 10,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> List[SocialPost]:
        """Search Twitter using API v2."""
        if not self.twitter_bearer_token:
            logger.warning("Twitter Bearer Token not configured")
            return []
        
        if not self._check_twitter_rate_limit():
            logger.error("Twitter API rate limit reached")
            return []
        
        # Check cache
        cache_key = f"twitter_search:{hash(str((query, max_results, start_time, end_time)))}"
        if cache_key in self._results_cache:
            logger.debug("Cache hit for Twitter search")
            return self._results_cache[cache_key]
        
        url = "https://api.twitter.com/2/tweets/search/recent"
        headers = {
            "Authorization": f"Bearer {self.twitter_bearer_token}",
            "Content-Type": "application/json"
        }
        
        params = {
            "query": query,
            "max_results": min(max_results, 100),  # API limit
            "tweet.fields": "created_at,author_id,public_metrics,context_annotations,entities,attachments",
            "user.fields": "username,name,verified,public_metrics",
            "media.fields": "url,preview_image_url,type",
            "expansions": "author_id,attachments.media_keys"
        }
        
        if start_time:
            params["start_time"] = start_time.isoformat() + "Z"
        if end_time:
            params["end_time"] = end_time.isoformat() + "Z"
        
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
            
            async with self.session.get(url, headers=headers, params=params, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    posts = self._parse_twitter_response(data)
                    self._results_cache[cache_key] = posts
                    return posts
                elif response.status == 429:
                    logger.warning("Twitter API rate limit hit")
                    await asyncio.sleep(60)
                else:
                    error_text = await response.text()
                    logger.error(f"Twitter API error {response.status}: {error_text}")
                    
        except Exception as e:
            logger.error(f"Twitter API request failed: {e}")
        
        return []
    
    def _parse_twitter_response(self, data: Dict[str, Any]) -> List[SocialPost]:
        """Parse Twitter API v2 response into SocialPost objects."""
        posts = []
        
        if "data" not in data:
            return posts
        
        # Create lookup dictionaries for includes
        users = {user["id"]: user for user in data.get("includes", {}).get("users", [])}
        media = {m["media_key"]: m for m in data.get("includes", {}).get("media", [])}
        
        for tweet in data["data"]:
            try:
                author_id = tweet.get("author_id", "")
                author_info = users.get(author_id, {})
                
                # Extract hashtags and mentions
                entities = tweet.get("entities", {})
                hashtags = [tag["tag"] for tag in entities.get("hashtags", [])]
                mentions = [mention["username"] for mention in entities.get("mentions", [])]
                
                # Extract media URLs
                media_urls = []
                if "attachments" in tweet and "media_keys" in tweet["attachments"]:
                    for media_key in tweet["attachments"]["media_keys"]:
                        if media_key in media:
                            media_info = media[media_key]
                            if media_info.get("url"):
                                media_urls.append(media_info["url"])
                            elif media_info.get("preview_image_url"):
                                media_urls.append(media_info["preview_image_url"])
                
                # Parse engagement metrics
                metrics = tweet.get("public_metrics", {})
                engagement = {
                    "likes": metrics.get("like_count", 0),
                    "retweets": metrics.get("retweet_count", 0),
                    "replies": metrics.get("reply_count", 0),
                    "quotes": metrics.get("quote_count", 0)
                }
                
                post = SocialPost(
                    post_id=tweet["id"],
                    platform="twitter",
                    author=author_info.get("username", ""),
                    author_id=author_id,
                    content=tweet.get("text", ""),
                    created_at=datetime.fromisoformat(tweet["created_at"].replace("Z", "+00:00")),
                    url=f"https://twitter.com/{author_info.get('username', 'i')}/status/{tweet['id']}",
                    engagement=engagement,
                    media_urls=media_urls,
                    hashtags=hashtags,
                    mentions=mentions,
                    metadata={
                        "context_annotations": tweet.get("context_annotations", []),
                        "author_verified": author_info.get("verified", False),
                        "author_followers": author_info.get("public_metrics", {}).get("followers_count", 0)
                    }
                )
                posts.append(post)
                
            except Exception as e:
                logger.error(f"Failed to parse Twitter post: {e}")
                continue
        
        return posts
    
    async def search_reddit(
        self, 
        query: str, 
        subreddit: Optional[str] = None,
        sort: str = "relevance",  # relevance, hot, top, new
        time_filter: str = "all",  # hour, day, week, month, year, all
        limit: int = 25
    ) -> List[SocialPost]:
        """Search Reddit posts."""
        if not self._check_reddit_rate_limit():
            logger.error("Reddit API rate limit reached")
            return []
        
        # Check cache
        cache_key = f"reddit_search:{hash(str((query, subreddit, sort, time_filter, limit)))}"
        if cache_key in self._results_cache:
            logger.debug("Cache hit for Reddit search")
            return self._results_cache[cache_key]
        
        # Use Reddit's public JSON API (no auth required)
        if subreddit:
            url = f"https://www.reddit.com/r/{subreddit}/search.json"
            params = {
                "q": query,
                "restrict_sr": "true",
                "sort": sort,
                "t": time_filter,
                "limit": min(limit, 100)
            }
        else:
            url = "https://www.reddit.com/search.json"
            params = {
                "q": query,
                "sort": sort,
                "t": time_filter,
                "limit": min(limit, 100)
            }
        
        headers = {
            "User-Agent": "RAGBOARD/1.0 (Content Research Tool)"
        }
        
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
            
            async with self.session.get(url, headers=headers, params=params, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    posts = self._parse_reddit_response(data)
                    self._results_cache[cache_key] = posts
                    return posts
                else:
                    error_text = await response.text()
                    logger.error(f"Reddit API error {response.status}: {error_text}")
                    
        except Exception as e:
            logger.error(f"Reddit API request failed: {e}")
        
        return []
    
    def _parse_reddit_response(self, data: Dict[str, Any]) -> List[SocialPost]:
        """Parse Reddit API response into SocialPost objects."""
        posts = []
        
        if "data" not in data or "children" not in data["data"]:
            return posts
        
        for item in data["data"]["children"]:
            try:
                post_data = item["data"]
                
                # Extract content
                content = post_data.get("title", "")
                if post_data.get("selftext"):
                    content += "\n\n" + post_data["selftext"]
                
                # Extract media URLs
                media_urls = []
                if post_data.get("url") and not post_data["url"].startswith("https://www.reddit.com"):
                    # External link
                    media_urls.append(post_data["url"])
                
                if post_data.get("preview", {}).get("images"):
                    for img in post_data["preview"]["images"]:
                        if img.get("source", {}).get("url"):
                            media_urls.append(img["source"]["url"])
                
                # Parse engagement
                engagement = {
                    "upvotes": post_data.get("ups", 0),
                    "downvotes": post_data.get("downs", 0),
                    "score": post_data.get("score", 0),
                    "comments": post_data.get("num_comments", 0)
                }
                
                # Extract hashtags (Reddit doesn't have official hashtags, but look for #tags)
                hashtags = re.findall(r'#(\w+)', content)
                
                # Extract mentions (u/username format)
                mentions = re.findall(r'u/(\w+)', content)
                
                post = SocialPost(
                    post_id=post_data["id"],
                    platform="reddit",
                    author=post_data.get("author", ""),
                    author_id=post_data.get("author", ""),
                    content=content,
                    created_at=datetime.fromtimestamp(post_data.get("created_utc", 0)),
                    url=f"https://www.reddit.com{post_data.get('permalink', '')}",
                    engagement=engagement,
                    media_urls=media_urls,
                    hashtags=hashtags,
                    mentions=mentions,
                    metadata={
                        "subreddit": post_data.get("subreddit", ""),
                        "flair": post_data.get("link_flair_text", ""),
                        "gilded": post_data.get("gilded", 0),
                        "over_18": post_data.get("over_18", False),
                        "distinguished": post_data.get("distinguished"),
                        "stickied": post_data.get("stickied", False)
                    }
                )
                posts.append(post)
                
            except Exception as e:
                logger.error(f"Failed to parse Reddit post: {e}")
                continue
        
        return posts
    
    async def get_trending_hashtags(self, platform: str = "twitter") -> List[Dict[str, Any]]:
        """Get trending hashtags for a platform."""
        if platform == "twitter" and self.twitter_bearer_token:
            return await self._get_twitter_trends()
        else:
            logger.warning(f"Trending hashtags not supported for platform: {platform}")
            return []
    
    async def _get_twitter_trends(self, woeid: int = 1) -> List[Dict[str, Any]]:
        """Get Twitter trending topics."""
        if not self._check_twitter_rate_limit():
            return []
        
        url = f"https://api.twitter.com/1.1/trends/place.json"
        headers = {
            "Authorization": f"Bearer {self.twitter_bearer_token}"
        }
        params = {"id": woeid}  # 1 = Worldwide
        
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
            
            async with self.session.get(url, headers=headers, params=params, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    if data and len(data) > 0 and "trends" in data[0]:
                        return data[0]["trends"]
                else:
                    logger.error(f"Twitter trends API error {response.status}")
                    
        except Exception as e:
            logger.error(f"Twitter trends request failed: {e}")
        
        return []
    
    async def search_multiple_platforms(
        self, 
        query: str, 
        platforms: List[str] = None,
        max_results_per_platform: int = 10
    ) -> Dict[str, List[SocialPost]]:
        """Search across multiple social media platforms."""
        if platforms is None:
            platforms = ["twitter", "reddit"]
        
        results = {}
        tasks = []
        
        for platform in platforms:
            if platform == "twitter" and self.twitter_bearer_token:
                tasks.append(("twitter", self.search_twitter(query, max_results_per_platform)))
            elif platform == "reddit":
                tasks.append(("reddit", self.search_reddit(query, limit=max_results_per_platform)))
        
        # Execute searches in parallel
        if tasks:
            platform_results = await asyncio.gather(
                *[task[1] for task in tasks], 
                return_exceptions=True
            )
            
            for i, (platform, _) in enumerate(tasks):
                result = platform_results[i]
                if isinstance(result, Exception):
                    logger.error(f"Error searching {platform}: {result}")
                    results[platform] = []
                else:
                    results[platform] = result
        
        return results
    
    def extract_social_urls(self, text: str) -> List[Dict[str, str]]:
        """Extract social media URLs from text."""
        patterns = {
            "twitter": r'https?://(?:www\.)?(?:twitter\.com|x\.com)/\w+/status/(\d+)',
            "reddit": r'https?://(?:www\.)?reddit\.com/r/\w+/comments/(\w+)',
            "youtube": r'https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]+)',
            "instagram": r'https?://(?:www\.)?instagram\.com/p/([a-zA-Z0-9_-]+)',
            "tiktok": r'https?://(?:www\.)?tiktok\.com/@[\w.-]+/video/(\d+)',
            "linkedin": r'https?://(?:www\.)?linkedin\.com/posts/[\w-]+(\d+)'
        }
        
        found_urls = []
        for platform, pattern in patterns.items():
            matches = re.finditer(pattern, text)
            for match in matches:
                found_urls.append({
                    "platform": platform,
                    "url": match.group(0),
                    "id": match.group(1) if match.groups() else None
                })
        
        return found_urls
    
    async def get_api_usage(self) -> Dict[str, Any]:
        """Get current API usage across all platforms."""
        return {
            "twitter": {
                "requests_used": self._twitter_requests,
                "requests_limit": 300,
                "reset_time": self._twitter_reset_time.isoformat(),
                "has_token": bool(self.twitter_bearer_token)
            },
            "reddit": {
                "requests_used": self._reddit_requests,
                "requests_limit": 60,
                "reset_time": self._reddit_reset_time.isoformat(),
                "requires_auth": False
            },
            "cache_stats": {
                "results_cache_size": len(self._results_cache),
                "rate_limit_cache_size": len(self._rate_limit_cache)
            }
        }