"""
Meta Ads Library API integration service.
Provides access to political and social ads data from Facebook/Instagram.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import aiohttp
import json
from dataclasses import dataclass
from cachetools import TTLCache

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

@dataclass
class MetaAd:
    """Meta advertisement data structure."""
    ad_id: str
    ad_creation_time: datetime
    ad_creative_bodies: List[str]
    ad_creative_link_captions: List[str]
    ad_creative_link_descriptions: List[str]
    ad_creative_link_titles: List[str]
    ad_delivery_start_time: Optional[datetime]
    ad_delivery_stop_time: Optional[datetime]
    ad_snapshot_url: str
    currency: str
    demographic_distribution: List[Dict[str, Any]]
    delivery_by_region: List[Dict[str, Any]]
    impressions: Dict[str, Any]
    page_id: str
    page_name: str
    publisher_platforms: List[str]
    spend: Dict[str, Any]
    funding_entity: Optional[str]
    languages: List[str]

class MetaAdsService:
    """Meta Ads Library API service with rate limiting and caching."""
    
    BASE_URL = "https://graph.facebook.com/v18.0/ads_archive"
    
    def __init__(self, access_token: Optional[str] = None):
        """Initialize Meta Ads API service."""
        self.access_token = access_token or getattr(settings, 'meta_ads_access_token', None)
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Rate limiting (Facebook: 200 calls per hour per token)
        self._hourly_calls = 0
        self._last_hour_reset = datetime.now()
        self._rate_limit_cache = TTLCache(maxsize=1000, ttl=60)
        
        # Results cache (10 minute TTL)
        self._results_cache = TTLCache(maxsize=500, ttl=600)
        
        if not self.access_token:
            logger.warning("Meta Ads API access token not configured. Meta Ads features will be disabled.")
    
    async def __aenter__(self):
        """Async context manager entry."""
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    def _check_rate_limit(self) -> bool:
        """Check if we're within rate limits."""
        now = datetime.now()
        if (now - self._last_hour_reset).seconds >= 3600:
            self._hourly_calls = 0
            self._last_hour_reset = now
        
        if self._hourly_calls >= 180:  # Leave buffer
            logger.warning("Meta Ads API rate limit nearly reached")
            return False
        
        self._hourly_calls += 1
        return True
    
    def _get_cache_key(self, params: Dict[str, Any]) -> str:
        """Generate cache key from parameters."""
        sorted_params = sorted(params.items())
        return f"meta_ads:{hash(str(sorted_params))}"
    
    async def _make_request(self, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Make authenticated request to Meta Ads API."""
        if not self.access_token:
            logger.error("Meta Ads API access token not configured")
            return None
        
        if not self._check_rate_limit():
            logger.error("Meta Ads API rate limit reached")
            return None
        
        # Check cache first
        cache_key = self._get_cache_key(params)
        if cache_key in self._results_cache:
            logger.debug("Cache hit for Meta Ads request")
            return self._results_cache[cache_key]
        
        params["access_token"] = self.access_token
        
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
            
            async with self.session.get(self.BASE_URL, params=params, timeout=30) as response:
                if response.status == 200:
                    data = await response.json()
                    self._results_cache[cache_key] = data
                    return data
                elif response.status == 400:
                    error_data = await response.json()
                    logger.error(f"Meta Ads API bad request: {error_data}")
                elif response.status == 403:
                    logger.error("Meta Ads API access denied - check permissions")
                elif response.status == 429:
                    logger.warning("Meta Ads API rate limit hit, waiting...")
                    await asyncio.sleep(60)  # Wait 1 minute
                    return await self._make_request(params)
                else:
                    logger.error(f"Meta Ads API error {response.status}: {await response.text()}")
                    
        except asyncio.TimeoutError:
            logger.error("Meta Ads API request timeout")
        except Exception as e:
            logger.error(f"Meta Ads API request failed: {e}")
        
        return None
    
    async def search_ads(
        self,
        search_terms: Optional[str] = None,
        ad_reached_countries: List[str] = None,
        ad_delivery_date_min: Optional[datetime] = None,
        ad_delivery_date_max: Optional[datetime] = None,
        search_page_ids: List[str] = None,
        publisher_platforms: List[str] = None,
        limit: int = 100
    ) -> List[MetaAd]:
        """Search for ads in the Meta Ads Library."""
        if not self.access_token:
            return []
        
        params = {
            "fields": ",".join([
                "id", "ad_creation_time", "ad_creative_bodies", 
                "ad_creative_link_captions", "ad_creative_link_descriptions",
                "ad_creative_link_titles", "ad_delivery_start_time",
                "ad_delivery_stop_time", "ad_snapshot_url", "currency",
                "demographic_distribution", "delivery_by_region",
                "impressions", "page_id", "page_name", "publisher_platforms",
                "spend", "funding_entity", "languages"
            ]),
            "limit": min(limit, 1000),  # API limit
            "ad_type": "POLITICAL_AND_ISSUE_ADS"  # Default to political ads
        }
        
        if search_terms:
            params["search_terms"] = search_terms
        
        if ad_reached_countries:
            params["ad_reached_countries"] = ad_reached_countries
        
        if ad_delivery_date_min:
            params["ad_delivery_date_min"] = ad_delivery_date_min.strftime("%Y-%m-%d")
        
        if ad_delivery_date_max:
            params["ad_delivery_date_max"] = ad_delivery_date_max.strftime("%Y-%m-%d")
        
        if search_page_ids:
            params["search_page_ids"] = search_page_ids
        
        if publisher_platforms:
            params["publisher_platforms"] = publisher_platforms
        
        data = await self._make_request(params)
        if not data or "data" not in data:
            return []
        
        ads = []
        for item in data["data"]:
            try:
                ad = MetaAd(
                    ad_id=item.get("id", ""),
                    ad_creation_time=self._parse_datetime(item.get("ad_creation_time")),
                    ad_creative_bodies=item.get("ad_creative_bodies", []),
                    ad_creative_link_captions=item.get("ad_creative_link_captions", []),
                    ad_creative_link_descriptions=item.get("ad_creative_link_descriptions", []),
                    ad_creative_link_titles=item.get("ad_creative_link_titles", []),
                    ad_delivery_start_time=self._parse_datetime(item.get("ad_delivery_start_time")),
                    ad_delivery_stop_time=self._parse_datetime(item.get("ad_delivery_stop_time")),
                    ad_snapshot_url=item.get("ad_snapshot_url", ""),
                    currency=item.get("currency", ""),
                    demographic_distribution=item.get("demographic_distribution", []),
                    delivery_by_region=item.get("delivery_by_region", []),
                    impressions=item.get("impressions", {}),
                    page_id=item.get("page_id", ""),
                    page_name=item.get("page_name", ""),
                    publisher_platforms=item.get("publisher_platforms", []),
                    spend=item.get("spend", {}),
                    funding_entity=item.get("funding_entity"),
                    languages=item.get("languages", [])
                )
                ads.append(ad)
            except Exception as e:
                logger.error(f"Failed to parse Meta ad data: {e}")
                continue
        
        return ads
    
    async def get_ad_by_id(self, ad_id: str) -> Optional[MetaAd]:
        """Get detailed information for a specific ad."""
        params = {
            "ids": ad_id,
            "fields": ",".join([
                "id", "ad_creation_time", "ad_creative_bodies", 
                "ad_creative_link_captions", "ad_creative_link_descriptions",
                "ad_creative_link_titles", "ad_delivery_start_time",
                "ad_delivery_stop_time", "ad_snapshot_url", "currency",
                "demographic_distribution", "delivery_by_region",
                "impressions", "page_id", "page_name", "publisher_platforms",
                "spend", "funding_entity", "languages"
            ])
        }
        
        data = await self._make_request(params)
        if not data or "data" not in data or not data["data"]:
            return None
        
        item = data["data"][0]
        try:
            return MetaAd(
                ad_id=item.get("id", ""),
                ad_creation_time=self._parse_datetime(item.get("ad_creation_time")),
                ad_creative_bodies=item.get("ad_creative_bodies", []),
                ad_creative_link_captions=item.get("ad_creative_link_captions", []),
                ad_creative_link_descriptions=item.get("ad_creative_link_descriptions", []),
                ad_creative_link_titles=item.get("ad_creative_link_titles", []),
                ad_delivery_start_time=self._parse_datetime(item.get("ad_delivery_start_time")),
                ad_delivery_stop_time=self._parse_datetime(item.get("ad_delivery_stop_time")),
                ad_snapshot_url=item.get("ad_snapshot_url", ""),
                currency=item.get("currency", ""),
                demographic_distribution=item.get("demographic_distribution", []),
                delivery_by_region=item.get("delivery_by_region", []),
                impressions=item.get("impressions", {}),
                page_id=item.get("page_id", ""),
                page_name=item.get("page_name", ""),
                publisher_platforms=item.get("publisher_platforms", []),
                spend=item.get("spend", {}),
                funding_entity=item.get("funding_entity"),
                languages=item.get("languages", [])
            )
        except Exception as e:
            logger.error(f"Failed to parse Meta ad data: {e}")
            return None
    
    async def search_by_page(self, page_name: str, limit: int = 100) -> List[MetaAd]:
        """Search for ads by page name."""
        return await self.search_ads(
            search_terms=page_name,
            limit=limit
        )
    
    async def get_page_ads(self, page_id: str, limit: int = 100) -> List[MetaAd]:
        """Get all ads for a specific page ID."""
        return await self.search_ads(
            search_page_ids=[page_id],
            limit=limit
        )
    
    async def search_recent_ads(
        self, 
        search_terms: str, 
        days_back: int = 30,
        limit: int = 100
    ) -> List[MetaAd]:
        """Search for recent ads within specified time range."""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        
        return await self.search_ads(
            search_terms=search_terms,
            ad_delivery_date_min=start_date,
            ad_delivery_date_max=end_date,
            limit=limit
        )
    
    async def get_ads_by_country(
        self, 
        country_codes: List[str], 
        search_terms: Optional[str] = None,
        limit: int = 100
    ) -> List[MetaAd]:
        """Get ads targeted to specific countries."""
        return await self.search_ads(
            search_terms=search_terms,
            ad_reached_countries=country_codes,
            limit=limit
        )
    
    def _parse_datetime(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse datetime string from Meta API."""
        if not date_str:
            return None
        
        try:
            # Meta API returns ISO format dates
            return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except Exception as e:
            logger.error(f"Failed to parse datetime '{date_str}': {e}")
            return None
    
    async def get_api_usage(self) -> Dict[str, Any]:
        """Get current API usage information."""
        return {
            "hourly_calls_used": self._hourly_calls,
            "hourly_calls_limit": 200,
            "calls_remaining": 200 - self._hourly_calls,
            "last_reset": self._last_hour_reset.isoformat(),
            "cache_size": len(self._results_cache),
            "rate_limit_cache_size": len(self._rate_limit_cache)
        }
    
    async def get_supported_countries(self) -> List[Dict[str, str]]:
        """Get list of supported country codes for ad targeting."""
        # Common country codes supported by Meta Ads Library
        return [
            {"code": "US", "name": "United States"},
            {"code": "CA", "name": "Canada"},
            {"code": "GB", "name": "United Kingdom"},
            {"code": "AU", "name": "Australia"},
            {"code": "DE", "name": "Germany"},
            {"code": "FR", "name": "France"},
            {"code": "IT", "name": "Italy"},
            {"code": "ES", "name": "Spain"},
            {"code": "BR", "name": "Brazil"},
            {"code": "IN", "name": "India"},
            {"code": "JP", "name": "Japan"},
            {"code": "KR", "name": "South Korea"},
            {"code": "MX", "name": "Mexico"},
            {"code": "AR", "name": "Argentina"},
            {"code": "CL", "name": "Chile"},
            {"code": "CO", "name": "Colombia"},
            {"code": "PE", "name": "Peru"},
            {"code": "UY", "name": "Uruguay"},
            {"code": "NL", "name": "Netherlands"},
            {"code": "BE", "name": "Belgium"},
            {"code": "CH", "name": "Switzerland"},
            {"code": "AT", "name": "Austria"},
            {"code": "SE", "name": "Sweden"},
            {"code": "NO", "name": "Norway"},
            {"code": "DK", "name": "Denmark"},
            {"code": "FI", "name": "Finland"},
            {"code": "PL", "name": "Poland"},
            {"code": "CZ", "name": "Czech Republic"},
            {"code": "HU", "name": "Hungary"},
            {"code": "SK", "name": "Slovakia"},
            {"code": "SI", "name": "Slovenia"},
            {"code": "HR", "name": "Croatia"},
            {"code": "BG", "name": "Bulgaria"},
            {"code": "RO", "name": "Romania"},
            {"code": "GR", "name": "Greece"},
            {"code": "CY", "name": "Cyprus"},
            {"code": "MT", "name": "Malta"},
            {"code": "LU", "name": "Luxembourg"},
            {"code": "IE", "name": "Ireland"},
            {"code": "PT", "name": "Portugal"},
            {"code": "LV", "name": "Latvia"},
            {"code": "LT", "name": "Lithuania"},
            {"code": "EE", "name": "Estonia"}
        ]