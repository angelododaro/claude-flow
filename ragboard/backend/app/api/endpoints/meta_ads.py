"""
Meta Ads Library API endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime

from app.services.external.meta_ads import MetaAdsService
from app.core.config import get_settings

settings = get_settings()
router = APIRouter()

@router.get("/search", summary="Search Meta Ads Library")
async def search_ads(
    search_terms: str = Query(..., description="Keywords to search for"),
    ad_reached_countries: Optional[str] = Query(None, description="Comma-separated country codes"),
    ad_delivery_date_min: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    ad_delivery_date_max: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    search_page_ids: Optional[str] = Query(None, description="Comma-separated page IDs"),
    publisher_platforms: Optional[str] = Query(None, description="Comma-separated platforms"),
    limit: int = Query(50, ge=1, le=1000, description="Number of results to return")
):
    """
    Search political and social issue ads from Meta's Ad Library.
    
    This endpoint allows searching for ads by keywords, filtering by country,
    date range, page IDs, and platform. Results are cached for performance.
    """
    try:
        async with MetaAdsService() as service:
            # Parse country codes
            countries = None
            if ad_reached_countries:
                countries = [c.strip() for c in ad_reached_countries.split(',')]
            
            # Parse dates
            date_min = None
            date_max = None
            if ad_delivery_date_min:
                try:
                    date_min = datetime.strptime(ad_delivery_date_min, "%Y-%m-%d")
                except ValueError:
                    raise HTTPException(status_code=400, detail="Invalid start date format. Use YYYY-MM-DD")
            
            if ad_delivery_date_max:
                try:
                    date_max = datetime.strptime(ad_delivery_date_max, "%Y-%m-%d")
                except ValueError:
                    raise HTTPException(status_code=400, detail="Invalid end date format. Use YYYY-MM-DD")
            
            # Parse page IDs
            page_ids = None
            if search_page_ids:
                page_ids = [p.strip() for p in search_page_ids.split(',')]
            
            # Parse platforms
            platforms = None
            if publisher_platforms:
                platforms = [p.strip() for p in publisher_platforms.split(',')]
            
            # Search ads
            ads = await service.search_ads(
                search_terms=search_terms,
                ad_reached_countries=countries,
                ad_delivery_date_min=date_min,
                ad_delivery_date_max=date_max,
                search_page_ids=page_ids,
                publisher_platforms=platforms,
                limit=limit
            )
            
            # Convert to dict for JSON response
            ads_data = []
            for ad in ads:
                ads_data.append({
                    "ad_id": ad.ad_id,
                    "ad_creation_time": ad.ad_creation_time.isoformat() if ad.ad_creation_time else None,
                    "ad_creative_bodies": ad.ad_creative_bodies,
                    "ad_creative_link_captions": ad.ad_creative_link_captions,
                    "ad_creative_link_descriptions": ad.ad_creative_link_descriptions,
                    "ad_creative_link_titles": ad.ad_creative_link_titles,
                    "ad_delivery_start_time": ad.ad_delivery_start_time.isoformat() if ad.ad_delivery_start_time else None,
                    "ad_delivery_stop_time": ad.ad_delivery_stop_time.isoformat() if ad.ad_delivery_stop_time else None,
                    "ad_snapshot_url": ad.ad_snapshot_url,
                    "currency": ad.currency,
                    "demographic_distribution": ad.demographic_distribution,
                    "delivery_by_region": ad.delivery_by_region,
                    "impressions": ad.impressions,
                    "page_id": ad.page_id,
                    "page_name": ad.page_name,
                    "publisher_platforms": ad.publisher_platforms,
                    "spend": ad.spend,
                    "funding_entity": ad.funding_entity,
                    "languages": ad.languages
                })
            
            return {
                "success": True,
                "count": len(ads_data),
                "ads": ads_data
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search ads: {str(e)}")

@router.get("/ad/{ad_id}", summary="Get specific ad by ID")
async def get_ad_by_id(ad_id: str):
    """
    Get detailed information for a specific advertisement by ID.
    """
    try:
        async with MetaAdsService() as service:
            ad = await service.get_ad_by_id(ad_id)
            
            if not ad:
                raise HTTPException(status_code=404, detail="Ad not found")
            
            return {
                "success": True,
                "ad": {
                    "ad_id": ad.ad_id,
                    "ad_creation_time": ad.ad_creation_time.isoformat() if ad.ad_creation_time else None,
                    "ad_creative_bodies": ad.ad_creative_bodies,
                    "ad_creative_link_captions": ad.ad_creative_link_captions,
                    "ad_creative_link_descriptions": ad.ad_creative_link_descriptions,
                    "ad_creative_link_titles": ad.ad_creative_link_titles,
                    "ad_delivery_start_time": ad.ad_delivery_start_time.isoformat() if ad.ad_delivery_start_time else None,
                    "ad_delivery_stop_time": ad.ad_delivery_stop_time.isoformat() if ad.ad_delivery_stop_time else None,
                    "ad_snapshot_url": ad.ad_snapshot_url,
                    "currency": ad.currency,
                    "demographic_distribution": ad.demographic_distribution,
                    "delivery_by_region": ad.delivery_by_region,
                    "impressions": ad.impressions,
                    "page_id": ad.page_id,
                    "page_name": ad.page_name,
                    "publisher_platforms": ad.publisher_platforms,
                    "spend": ad.spend,
                    "funding_entity": ad.funding_entity,
                    "languages": ad.languages
                }
            }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get ad: {str(e)}")

@router.get("/countries", summary="Get supported countries")
async def get_supported_countries():
    """
    Get list of countries supported by Meta Ads Library.
    """
    try:
        async with MetaAdsService() as service:
            countries = await service.get_supported_countries()
            return {
                "success": True,
                "countries": countries
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get countries: {str(e)}")

@router.get("/page/{page_id}/ads", summary="Get ads for specific page")
async def get_page_ads(
    page_id: str,
    limit: int = Query(50, ge=1, le=1000, description="Number of results to return")
):
    """
    Get all ads for a specific Facebook/Instagram page.
    """
    try:
        async with MetaAdsService() as service:
            ads = await service.get_page_ads(page_id, limit)
            
            ads_data = []
            for ad in ads:
                ads_data.append({
                    "ad_id": ad.ad_id,
                    "ad_creation_time": ad.ad_creation_time.isoformat() if ad.ad_creation_time else None,
                    "ad_creative_bodies": ad.ad_creative_bodies,
                    "ad_creative_link_titles": ad.ad_creative_link_titles,
                    "ad_snapshot_url": ad.ad_snapshot_url,
                    "page_name": ad.page_name,
                    "publisher_platforms": ad.publisher_platforms,
                    "spend": ad.spend,
                    "impressions": ad.impressions
                })
            
            return {
                "success": True,
                "page_id": page_id,
                "count": len(ads_data),
                "ads": ads_data
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get page ads: {str(e)}")

@router.get("/usage", summary="Get API usage statistics")
async def get_usage_stats():
    """
    Get current Meta Ads API usage information and limits.
    """
    try:
        async with MetaAdsService() as service:
            usage = await service.get_api_usage()
            return {
                "success": True,
                "usage": usage
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get usage stats: {str(e)}")

@router.get("/recent", summary="Get recent ads")
async def get_recent_ads(
    search_terms: str = Query(..., description="Keywords to search for"),
    days_back: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    limit: int = Query(50, ge=1, le=1000, description="Number of results to return")
):
    """
    Get recent ads within the specified time range.
    """
    try:
        async with MetaAdsService() as service:
            ads = await service.search_recent_ads(
                search_terms=search_terms,
                days_back=days_back,
                limit=limit
            )
            
            ads_data = []
            for ad in ads:
                ads_data.append({
                    "ad_id": ad.ad_id,
                    "ad_creation_time": ad.ad_creation_time.isoformat() if ad.ad_creation_time else None,
                    "ad_creative_bodies": ad.ad_creative_bodies,
                    "ad_creative_link_titles": ad.ad_creative_link_titles,
                    "ad_snapshot_url": ad.ad_snapshot_url,
                    "page_name": ad.page_name,
                    "publisher_platforms": ad.publisher_platforms,
                    "spend": ad.spend,
                    "impressions": ad.impressions
                })
            
            return {
                "success": True,
                "count": len(ads_data),
                "search_terms": search_terms,
                "days_back": days_back,
                "ads": ads_data
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get recent ads: {str(e)}")