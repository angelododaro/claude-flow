"""
External API integration endpoints for content search and import.
"""

from typing import Annotated, List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.base import get_async_session
from app.models.user import User
from app.models.resource import Resource, ResourceType, ProcessingStatus
from app.api.dependencies.auth import get_current_active_user
from app.schemas.resource import ResourceResponse
from app.services.external.youtube_api import YouTubeAPIService, YouTubeVideo
from app.services.external.meta_ads import MetaAdsService, MetaAd
from app.services.external.social_media import SocialMediaService, SocialPost
from app.services.processing import ProcessingService
from app.services.api_keys import APIKeyService

router = APIRouter(prefix="/external", tags=["external-apis"])

# Initialize services
processing_service = ProcessingService()
api_key_service = APIKeyService()
logger = logging.getLogger(__name__)


class YouTubeSearchRequest(BaseModel):
    """YouTube search request model."""
    query: str = Field(..., min_length=1, max_length=100)
    max_results: int = Field(default=10, ge=1, le=50)
    published_after: Optional[datetime] = None
    published_before: Optional[datetime] = None
    channel_id: Optional[str] = None
    video_duration: Optional[str] = Field(None, regex="^(short|medium|long)$")
    order: str = Field(default="relevance", regex="^(date|rating|relevance|title|viewCount)$")


class MetaAdsSearchRequest(BaseModel):
    """Meta Ads search request model."""
    search_terms: Optional[str] = None
    ad_reached_countries: Optional[List[str]] = None
    ad_delivery_date_min: Optional[datetime] = None
    ad_delivery_date_max: Optional[datetime] = None
    search_page_ids: Optional[List[str]] = None
    publisher_platforms: Optional[List[str]] = None
    limit: int = Field(default=25, ge=1, le=100)


class SocialMediaSearchRequest(BaseModel):
    """Social media search request model."""
    query: str = Field(..., min_length=1, max_length=100)
    platforms: List[str] = Field(default=["twitter", "reddit"])
    max_results_per_platform: int = Field(default=10, ge=1, le=50)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class ContentImportRequest(BaseModel):
    """Content import request model."""
    content_id: str = Field(..., description="Platform-specific content ID")
    platform: str = Field(..., description="Platform name (youtube, twitter, reddit, etc.)")
    name: Optional[str] = None
    description: Optional[str] = None
    collection_id: Optional[UUID] = None
    tags: Optional[List[str]] = None
    import_metadata: bool = Field(default=True, description="Import platform metadata")
    import_transcript: bool = Field(default=True, description="Import transcript/captions if available")


class APIUsageResponse(BaseModel):
    """API usage statistics response."""
    service: str
    usage_data: Dict[str, Any]
    timestamp: datetime


@router.get("/youtube/search")
async def search_youtube_videos(
    request: YouTubeSearchRequest = Depends(),
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> List[Dict[str, Any]]:
    """
    Search YouTube videos using the YouTube Data API.
    """
    async with YouTubeAPIService() as youtube_service:
        videos = await youtube_service.search_videos(
            query=request.query,
            max_results=request.max_results,
            published_after=request.published_after,
            published_before=request.published_before,
            channel_id=request.channel_id,
            video_duration=request.video_duration,
            order=request.order
        )
        
        # Convert to dict for JSON response
        return [
            {
                "video_id": video.video_id,
                "title": video.title,
                "description": video.description[:500] + "..." if len(video.description) > 500 else video.description,
                "channel_title": video.channel_title,
                "channel_id": video.channel_id,
                "published_at": video.published_at.isoformat(),
                "duration": video.duration,
                "view_count": video.view_count,
                "like_count": video.like_count,
                "comment_count": video.comment_count,
                "thumbnail_url": video.thumbnail_url,
                "tags": video.tags[:10],  # Limit tags for response size
                "captions_available": video.captions_available,
                "url": f"https://www.youtube.com/watch?v={video.video_id}"
            }
            for video in videos
        ]


@router.get("/youtube/video/{video_id}")
async def get_youtube_video(
    video_id: str,
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> Dict[str, Any]:
    """
    Get detailed information for a specific YouTube video.
    """
    async with YouTubeAPIService() as youtube_service:
        video = await youtube_service.get_video_by_id(video_id)
        
        if not video:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Video not found or API quota exceeded"
            )
        
        return {
            "video_id": video.video_id,
            "title": video.title,
            "description": video.description,
            "channel_title": video.channel_title,
            "channel_id": video.channel_id,
            "published_at": video.published_at.isoformat(),
            "duration": video.duration,
            "view_count": video.view_count,
            "like_count": video.like_count,
            "comment_count": video.comment_count,
            "thumbnail_url": video.thumbnail_url,
            "tags": video.tags,
            "category_id": video.category_id,
            "default_language": video.default_language,
            "captions_available": video.captions_available,
            "url": f"https://www.youtube.com/watch?v={video.video_id}"
        }


@router.get("/youtube/captions/{video_id}")
async def get_youtube_captions(
    video_id: str,
    language: str = Query(default="en", description="Caption language code"),
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> Dict[str, Any]:
    """
    Get captions/transcript for a YouTube video.
    """
    async with YouTubeAPIService() as youtube_service:
        captions = await youtube_service.get_video_captions(video_id, language)
        
        if not captions:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Captions not available for this video"
            )
        
        return {
            "video_id": video_id,
            "language": language,
            "transcript": captions,
            "character_count": len(captions),
            "word_count": len(captions.split())
        }


@router.get("/youtube/trending")
async def get_youtube_trending(
    region_code: str = Query(default="US", description="Country code for trending videos"),
    category_id: Optional[str] = Query(None, description="Video category ID"),
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> List[Dict[str, Any]]:
    """
    Get trending YouTube videos for a region.
    """
    async with YouTubeAPIService() as youtube_service:
        videos = await youtube_service.get_trending_videos(region_code, category_id)
        
        return [
            {
                "video_id": video.video_id,
                "title": video.title,
                "channel_title": video.channel_title,
                "published_at": video.published_at.isoformat(),
                "view_count": video.view_count,
                "like_count": video.like_count,
                "thumbnail_url": video.thumbnail_url,
                "url": f"https://www.youtube.com/watch?v={video.video_id}"
            }
            for video in videos
        ]


@router.post("/meta-ads/search")
async def search_meta_ads(
    request: MetaAdsSearchRequest,
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> List[Dict[str, Any]]:
    """
    Search Meta Ads Library for political and social ads.
    """
    async with MetaAdsService() as meta_service:
        ads = await meta_service.search_ads(
            search_terms=request.search_terms,
            ad_reached_countries=request.ad_reached_countries,
            ad_delivery_date_min=request.ad_delivery_date_min,
            ad_delivery_date_max=request.ad_delivery_date_max,
            search_page_ids=request.search_page_ids,
            publisher_platforms=request.publisher_platforms,
            limit=request.limit
        )
        
        return [
            {
                "ad_id": ad.ad_id,
                "ad_creative_bodies": ad.ad_creative_bodies,
                "ad_creative_link_titles": ad.ad_creative_link_titles,
                "page_name": ad.page_name,
                "page_id": ad.page_id,
                "ad_creation_time": ad.ad_creation_time.isoformat() if ad.ad_creation_time else None,
                "ad_delivery_start_time": ad.ad_delivery_start_time.isoformat() if ad.ad_delivery_start_time else None,
                "ad_delivery_stop_time": ad.ad_delivery_stop_time.isoformat() if ad.ad_delivery_stop_time else None,
                "ad_snapshot_url": ad.ad_snapshot_url,
                "currency": ad.currency,
                "impressions": ad.impressions,
                "spend": ad.spend,
                "funding_entity": ad.funding_entity,
                "publisher_platforms": ad.publisher_platforms,
                "languages": ad.languages
            }
            for ad in ads
        ]


@router.get("/meta-ads/ad/{ad_id}")
async def get_meta_ad(
    ad_id: str,
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> Dict[str, Any]:
    """
    Get detailed information for a specific Meta ad.
    """
    async with MetaAdsService() as meta_service:
        ad = await meta_service.get_ad_by_id(ad_id)
        
        if not ad:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ad not found or API rate limit exceeded"
            )
        
        return {
            "ad_id": ad.ad_id,
            "ad_creative_bodies": ad.ad_creative_bodies,
            "ad_creative_link_captions": ad.ad_creative_link_captions,
            "ad_creative_link_descriptions": ad.ad_creative_link_descriptions,
            "ad_creative_link_titles": ad.ad_creative_link_titles,
            "page_name": ad.page_name,
            "page_id": ad.page_id,
            "ad_creation_time": ad.ad_creation_time.isoformat() if ad.ad_creation_time else None,
            "ad_delivery_start_time": ad.ad_delivery_start_time.isoformat() if ad.ad_delivery_start_time else None,
            "ad_delivery_stop_time": ad.ad_delivery_stop_time.isoformat() if ad.ad_delivery_stop_time else None,
            "ad_snapshot_url": ad.ad_snapshot_url,
            "currency": ad.currency,
            "demographic_distribution": ad.demographic_distribution,
            "delivery_by_region": ad.delivery_by_region,
            "impressions": ad.impressions,
            "spend": ad.spend,
            "funding_entity": ad.funding_entity,
            "publisher_platforms": ad.publisher_platforms,
            "languages": ad.languages
        }


@router.post("/social-media/search")
async def search_social_media(
    request: SocialMediaSearchRequest,
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Search across multiple social media platforms.
    """
    async with SocialMediaService() as social_service:
        results = await social_service.search_multiple_platforms(
            query=request.query,
            platforms=request.platforms,
            max_results_per_platform=request.max_results_per_platform
        )
        
        # Convert results to dict format
        formatted_results = {}
        for platform, posts in results.items():
            formatted_results[platform] = [
                {
                    "post_id": post.post_id,
                    "platform": post.platform,
                    "author": post.author,
                    "content": post.content[:500] + "..." if len(post.content) > 500 else post.content,
                    "created_at": post.created_at.isoformat(),
                    "url": post.url,
                    "engagement": post.engagement,
                    "media_urls": post.media_urls[:3],  # Limit media URLs
                    "hashtags": post.hashtags[:10],  # Limit hashtags
                    "mentions": post.mentions[:5],  # Limit mentions
                    "metadata": {k: v for k, v in post.metadata.items() if k in ["subreddit", "author_verified", "flair"]}
                }
                for post in posts
            ]
        
        return formatted_results


@router.get("/social-media/trending/{platform}")
async def get_trending_social_content(
    platform: str,
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> List[Dict[str, Any]]:
    """
    Get trending hashtags or content for a social media platform.
    """
    async with SocialMediaService() as social_service:
        trends = await social_service.get_trending_hashtags(platform)
        
        return trends


@router.post("/import")
async def import_external_content(
    request: ContentImportRequest,
    current_user: Annotated[User, Depends(get_current_active_user)] = None,
    db: AsyncSession = Depends(get_async_session)
) -> ResourceResponse:
    """
    Import content from external platforms as a resource.
    """
    content_data = None
    resource_type = ResourceType.WEBPAGE
    source_url = None
    source_metadata = {}
    extracted_text = ""
    
    try:
        # Import based on platform
        if request.platform == "youtube":
            async with YouTubeAPIService() as youtube_service:
                video = await youtube_service.get_video_by_id(request.content_id)
                if not video:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="YouTube video not found"
                    )
                
                content_data = video
                resource_type = ResourceType.VIDEO
                source_url = f"https://www.youtube.com/watch?v={video.video_id}"
                source_metadata = {
                    "platform": "youtube",
                    "video_id": video.video_id,
                    "channel_id": video.channel_id,
                    "channel_title": video.channel_title,
                    "duration": video.duration,
                    "view_count": video.view_count,
                    "like_count": video.like_count,
                    "published_at": video.published_at.isoformat(),
                    "tags": video.tags
                }
                
                # Extract text content
                extracted_text = f"Title: {video.title}\n\nDescription: {video.description}"
                
                # Get transcript if requested and available
                if request.import_transcript and video.captions_available:
                    transcript = await youtube_service.get_video_captions(video.video_id)
                    if transcript:
                        extracted_text += f"\n\nTranscript:\n{transcript}"
        
        elif request.platform == "twitter":
            # Twitter post import would go here
            # For now, we'll use a placeholder
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="Twitter import not yet implemented"
            )
        
        elif request.platform == "reddit":
            # Reddit post import would go here
            # For now, we'll use a placeholder
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="Reddit import not yet implemented"
            )
        
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform: {request.platform}"
            )
        
        # Create resource in database
        resource_name = request.name or getattr(content_data, 'title', f"{request.platform} content")
        resource_description = request.description or f"Imported from {request.platform}"
        
        resource = Resource(
            name=resource_name,
            description=resource_description,
            resource_type=resource_type,
            source_url=source_url,
            source_metadata=source_metadata,
            extracted_text=extracted_text,
            user_id=current_user.id,
            collection_id=request.collection_id,
            tags=request.tags or [],
            processing_status=ProcessingStatus.COMPLETED if extracted_text else ProcessingStatus.PENDING
        )
        
        db.add(resource)
        await db.commit()
        await db.refresh(resource)
        
        # Queue for processing if needed
        if not extracted_text:
            await processing_service.queue_resource(resource.id)
        
        return ResourceResponse.model_validate(resource)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import content: {str(e)}"
        )


@router.get("/usage/youtube")
async def get_youtube_api_usage(
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> APIUsageResponse:
    """
    Get YouTube API usage statistics.
    """
    async with YouTubeAPIService() as youtube_service:
        usage_data = await youtube_service.get_quota_usage()
        
        return APIUsageResponse(
            service="youtube",
            usage_data=usage_data,
            timestamp=datetime.now()
        )


@router.get("/usage/meta-ads")
async def get_meta_ads_api_usage(
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> APIUsageResponse:
    """
    Get Meta Ads API usage statistics.
    """
    async with MetaAdsService() as meta_service:
        usage_data = await meta_service.get_api_usage()
        
        return APIUsageResponse(
            service="meta-ads",
            usage_data=usage_data,
            timestamp=datetime.now()
        )


@router.get("/usage/social-media")
async def get_social_media_api_usage(
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> APIUsageResponse:
    """
    Get social media API usage statistics.
    """
    async with SocialMediaService() as social_service:
        usage_data = await social_service.get_api_usage()
        
        return APIUsageResponse(
            service="social-media",
            usage_data=usage_data,
            timestamp=datetime.now()
        )


@router.get("/supported-countries")
async def get_supported_countries(
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> List[Dict[str, str]]:
    """
    Get list of supported countries for Meta Ads targeting.
    """
    async with MetaAdsService() as meta_service:
        return await meta_service.get_supported_countries()


@router.post("/extract-urls")
async def extract_social_urls(
    text: str,
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> List[Dict[str, str]]:
    """
    Extract social media URLs from text content.
    """
    async with SocialMediaService() as social_service:
        return social_service.extract_social_urls(text)


# API Key Management Endpoints

class APIKeySetRequest(BaseModel):
    """API key setup request model."""
    provider: str = Field(..., description="Provider ID (youtube, meta_ads, twitter, reddit)")
    keys: Dict[str, str] = Field(..., description="API keys for the provider")


@router.get("/providers")
async def get_supported_providers(
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> Dict[str, Any]:
    """
    Get list of supported API providers and their configuration status.
    """
    providers = api_key_service.get_supported_providers()
    user_providers = await api_key_service.list_user_providers(str(current_user.id))
    
    # Add validation status for each provider
    for provider_id in providers.keys():
        validation = await api_key_service.validate_provider_setup(provider_id)
        providers[provider_id].update(validation)
    
    return {
        "supported_providers": providers,
        "user_configuration": user_providers
    }


@router.get("/providers/{provider}/validate")
async def validate_provider_setup(
    provider: str,
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> Dict[str, Any]:
    """
    Validate if a specific provider is properly configured.
    """
    return await api_key_service.validate_provider_setup(provider)


@router.post("/api-keys")
async def set_api_keys(
    request: APIKeySetRequest,
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> Dict[str, Any]:
    """
    Set API keys for a specific provider.
    """
    try:
        success = await api_key_service.set_api_keys(
            user_id=str(current_user.id),
            provider=request.provider,
            keys=request.keys
        )
        
        if success:
            return {
                "success": True,
                "message": f"API keys configured successfully for {request.provider}",
                "provider": request.provider
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to configure API keys"
            )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to set API keys: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error while configuring API keys"
        )


@router.get("/api-keys/{provider}")
async def get_api_keys_status(
    provider: str,
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> Dict[str, Any]:
    """
    Get configuration status for a specific provider.
    """
    keys = await api_key_service.get_api_keys(str(current_user.id), provider)
    providers = api_key_service.get_supported_providers()
    
    if provider not in providers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found"
        )
    
    provider_config = providers[provider]
    
    return {
        "provider": provider,
        "name": provider_config['name'],
        "configured": keys is not None,
        "required_fields": provider_config['fields'],
        "setup_url": provider_config['setup_url']
    }


@router.delete("/api-keys/{provider}")
async def delete_api_keys(
    provider: str,
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> Dict[str, Any]:
    """
    Delete API keys for a specific provider.
    """
    success = await api_key_service.delete_api_keys(str(current_user.id), provider)
    
    if success:
        return {
            "success": True,
            "message": f"API keys deleted for {provider}",
            "provider": provider
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete API keys"
        )


@router.get("/api-keys")
async def list_user_api_providers(
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> List[Dict[str, Any]]:
    """
    List all API providers and their configuration status for the current user.
    """
    return await api_key_service.list_user_providers(str(current_user.id))


@router.get("/usage-stats")
async def get_all_api_usage_stats(
    current_user: Annotated[User, Depends(get_current_active_user)] = None
) -> Dict[str, Any]:
    """
    Get API usage statistics for all configured providers.
    """
    return await api_key_service.get_api_usage_stats(str(current_user.id))