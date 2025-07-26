"""
API Key management service for external integrations.
Handles secure storage and retrieval of API keys with encryption.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from cryptography.fernet import Fernet
import os
import json
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.base import get_async_session
from app.models.user import User

logger = logging.getLogger(__name__)

class APIKeyService:
    """Service for managing external API keys with encryption."""
    
    # Supported API providers
    SUPPORTED_PROVIDERS = {
        'youtube': {
            'name': 'YouTube Data API',
            'description': 'Access YouTube videos, channels, and search functionality',
            'setup_url': 'https://console.developers.google.com/apis/credentials',
            'fields': ['api_key'],
            'required': True
        },
        'meta_ads': {
            'name': 'Meta Ads Library API',
            'description': 'Access Facebook/Instagram political and social ads',
            'setup_url': 'https://developers.facebook.com/tools/explorer/',
            'fields': ['access_token'],
            'required': False
        },
        'twitter': {
            'name': 'Twitter API v2',
            'description': 'Access Twitter posts, trends, and user data',
            'setup_url': 'https://developer.twitter.com/en/portal/dashboard',
            'fields': ['bearer_token'],
            'required': False
        },
        'reddit': {
            'name': 'Reddit API',
            'description': 'Access Reddit posts and comments (no auth required for basic features)',
            'setup_url': 'https://www.reddit.com/prefs/apps',
            'fields': ['client_id', 'client_secret'],
            'required': False
        }
    }
    
    def __init__(self):
        """Initialize API key service."""
        self._encryption_key = self._get_or_create_encryption_key()
        self._cipher = Fernet(self._encryption_key)
        self._keys_cache: Dict[str, Dict[str, str]] = {}
        self._cache_timestamp = datetime.now()
        
    def _get_or_create_encryption_key(self) -> bytes:
        """Get or create encryption key for API keys."""
        key_file = Path("./api_keys_encryption.key")
        
        if key_file.exists():
            return key_file.read_bytes()
        else:
            # Generate new key
            key = Fernet.generate_key()
            key_file.write_bytes(key)
            key_file.chmod(0o600)  # Read/write for owner only
            logger.info("Generated new API key encryption key")
            return key
    
    def _encrypt_value(self, value: str) -> str:
        """Encrypt a value."""
        return self._cipher.encrypt(value.encode()).decode()
    
    def _decrypt_value(self, encrypted_value: str) -> str:
        """Decrypt a value."""
        return self._cipher.decrypt(encrypted_value.encode()).decode()
    
    async def set_api_keys(self, user_id: str, provider: str, keys: Dict[str, str]) -> bool:
        """Set API keys for a provider and user."""
        if provider not in self.SUPPORTED_PROVIDERS:
            raise ValueError(f"Unsupported provider: {provider}")
        
        provider_config = self.SUPPORTED_PROVIDERS[provider]
        
        # Validate required fields
        for field in provider_config['fields']:
            if field not in keys or not keys[field].strip():
                if provider_config['required']:
                    raise ValueError(f"Missing required field: {field}")
        
        # Test the API keys before storing
        if not await self._test_api_keys(provider, keys):
            raise ValueError("API keys validation failed")
        
        # Encrypt and store keys
        encrypted_keys = {}
        for field, value in keys.items():
            if value.strip():
                encrypted_keys[field] = self._encrypt_value(value.strip())
        
        # Store in file system (in production, use database)
        keys_dir = Path("./api_keys")
        keys_dir.mkdir(exist_ok=True)
        
        user_keys_file = keys_dir / f"{user_id}.json"
        
        # Load existing keys
        user_keys = {}
        if user_keys_file.exists():
            try:
                user_keys = json.loads(user_keys_file.read_text())
            except:
                logger.error(f"Failed to load existing keys for user {user_id}")
        
        # Update with new keys
        user_keys[provider] = {
            'keys': encrypted_keys,
            'updated_at': datetime.now().isoformat(),
            'tested': True
        }
        
        # Save to file
        user_keys_file.write_text(json.dumps(user_keys, indent=2))
        user_keys_file.chmod(0o600)
        
        # Update cache
        cache_key = f"{user_id}:{provider}"
        self._keys_cache[cache_key] = keys
        
        logger.info(f"API keys updated for user {user_id}, provider {provider}")
        return True
    
    async def get_api_keys(self, user_id: str, provider: str) -> Optional[Dict[str, str]]:
        """Get API keys for a provider and user."""
        if provider not in self.SUPPORTED_PROVIDERS:
            return None
        
        # Check cache first
        cache_key = f"{user_id}:{provider}"
        if cache_key in self._keys_cache:
            cache_age = (datetime.now() - self._cache_timestamp).seconds
            if cache_age < 300:  # 5 minute cache
                return self._keys_cache[cache_key]
        
        # Load from file
        keys_dir = Path("./api_keys")
        user_keys_file = keys_dir / f"{user_id}.json"
        
        if not user_keys_file.exists():
            return None
        
        try:
            user_keys = json.loads(user_keys_file.read_text())
            if provider not in user_keys:
                return None
            
            provider_data = user_keys[provider]
            encrypted_keys = provider_data['keys']
            
            # Decrypt keys
            decrypted_keys = {}
            for field, encrypted_value in encrypted_keys.items():
                decrypted_keys[field] = self._decrypt_value(encrypted_value)
            
            # Update cache
            self._keys_cache[cache_key] = decrypted_keys
            
            return decrypted_keys
            
        except Exception as e:
            logger.error(f"Failed to load API keys for user {user_id}, provider {provider}: {e}")
            return None
    
    async def delete_api_keys(self, user_id: str, provider: str) -> bool:
        """Delete API keys for a provider and user."""
        keys_dir = Path("./api_keys")
        user_keys_file = keys_dir / f"{user_id}.json"
        
        if not user_keys_file.exists():
            return True
        
        try:
            user_keys = json.loads(user_keys_file.read_text())
            
            if provider in user_keys:
                del user_keys[provider]
                
                if user_keys:
                    # Save updated keys
                    user_keys_file.write_text(json.dumps(user_keys, indent=2))
                else:
                    # Delete file if no keys left
                    user_keys_file.unlink()
            
            # Clear cache
            cache_key = f"{user_id}:{provider}"
            if cache_key in self._keys_cache:
                del self._keys_cache[cache_key]
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete API keys for user {user_id}, provider {provider}: {e}")
            return False
    
    async def list_user_providers(self, user_id: str) -> List[Dict[str, Any]]:
        """List all configured providers for a user."""
        keys_dir = Path("./api_keys")
        user_keys_file = keys_dir / f"{user_id}.json"
        
        configured_providers = []
        user_keys = {}
        
        if user_keys_file.exists():
            try:
                user_keys = json.loads(user_keys_file.read_text())
            except:
                pass
        
        for provider_id, provider_config in self.SUPPORTED_PROVIDERS.items():
            is_configured = provider_id in user_keys
            
            provider_info = {
                'id': provider_id,
                'name': provider_config['name'],
                'description': provider_config['description'],
                'setup_url': provider_config['setup_url'],
                'fields': provider_config['fields'],
                'required': provider_config['required'],
                'configured': is_configured,
                'updated_at': user_keys.get(provider_id, {}).get('updated_at') if is_configured else None
            }
            
            configured_providers.append(provider_info)
        
        return configured_providers
    
    async def _test_api_keys(self, provider: str, keys: Dict[str, str]) -> bool:
        """Test API keys to ensure they work."""
        try:
            if provider == 'youtube':
                from app.services.external.youtube_api import YouTubeAPIService
                
                # Test with a simple request
                async with YouTubeAPIService(api_key=keys.get('api_key')) as service:
                    # Try to get trending videos (low quota cost)
                    videos = await service.get_trending_videos(region_code="US")
                    return len(videos) > 0
            
            elif provider == 'meta_ads':
                from app.services.external.meta_ads import MetaAdsService
                
                # Test with a simple search
                async with MetaAdsService(access_token=keys.get('access_token')) as service:
                    ads = await service.search_ads(limit=1)
                    return True  # If no exception, the token is valid
            
            elif provider == 'twitter':
                from app.services.external.social_media import SocialMediaService
                
                # Test with trending hashtags
                async with SocialMediaService() as service:
                    service.twitter_bearer_token = keys.get('bearer_token')
                    trends = await service.get_trending_hashtags('twitter')
                    return True  # If no exception, the token is valid
            
            elif provider == 'reddit':
                # Reddit API doesn't require authentication for basic features
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"API key test failed for {provider}: {e}")
            return False
    
    async def get_api_usage_stats(self, user_id: str) -> Dict[str, Any]:
        """Get API usage statistics for all configured providers."""
        stats = {}
        
        user_providers = await self.list_user_providers(user_id)
        
        for provider_info in user_providers:
            if not provider_info['configured']:
                continue
                
            provider_id = provider_info['id']
            
            try:
                if provider_id == 'youtube':
                    from app.services.external.youtube_api import YouTubeAPIService
                    keys = await self.get_api_keys(user_id, provider_id)
                    if keys:
                        async with YouTubeAPIService(api_key=keys.get('api_key')) as service:
                            stats[provider_id] = await service.get_quota_usage()
                
                elif provider_id == 'meta_ads':
                    from app.services.external.meta_ads import MetaAdsService
                    keys = await self.get_api_keys(user_id, provider_id)
                    if keys:
                        async with MetaAdsService(access_token=keys.get('access_token')) as service:
                            stats[provider_id] = await service.get_api_usage()
                
                elif provider_id == 'twitter' or provider_id == 'reddit':
                    from app.services.external.social_media import SocialMediaService
                    async with SocialMediaService() as service:
                        stats[provider_id] = await service.get_api_usage()
                        
            except Exception as e:
                logger.error(f"Failed to get usage stats for {provider_id}: {e}")
                stats[provider_id] = {"error": str(e)}
        
        return stats
    
    def get_supported_providers(self) -> Dict[str, Dict[str, Any]]:
        """Get list of all supported providers."""
        return self.SUPPORTED_PROVIDERS.copy()
    
    async def validate_provider_setup(self, provider: str) -> Dict[str, Any]:
        """Validate if a provider is properly set up."""
        if provider not in self.SUPPORTED_PROVIDERS:
            return {"valid": False, "error": "Unsupported provider"}
        
        provider_config = self.SUPPORTED_PROVIDERS[provider]
        
        # Check if provider has global configuration
        global_keys = {}
        if provider == 'youtube':
            global_keys['api_key'] = settings.youtube_api_key
        elif provider == 'meta_ads':
            global_keys['access_token'] = settings.meta_ads_access_token
        elif provider == 'twitter':
            global_keys['bearer_token'] = settings.twitter_bearer_token
        elif provider == 'reddit':
            global_keys['client_id'] = settings.reddit_client_id
            global_keys['client_secret'] = settings.reddit_client_secret
        
        # Check if required fields are configured globally
        missing_global = []
        for field in provider_config['fields']:
            if not global_keys.get(field):
                missing_global.append(field)
        
        return {
            "valid": len(missing_global) == 0,
            "provider": provider_config['name'],
            "globally_configured": len(missing_global) == 0,
            "missing_global_fields": missing_global,
            "requires_user_setup": len(missing_global) > 0,
            "setup_url": provider_config['setup_url']
        }