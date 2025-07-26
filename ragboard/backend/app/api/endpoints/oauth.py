"""
OAuth authentication endpoints.
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
import httpx
import secrets
import json
from urllib.parse import urlencode

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token
from app.db.base import get_async_session
from app.models.user import User
from app.api.endpoints.auth import UserResponse, Token
from app.api.dependencies.auth import get_current_active_user


router = APIRouter(prefix="/oauth", tags=["oauth"])


class OAuthProvider(BaseModel):
    """OAuth provider configuration."""
    name: str
    client_id: str
    client_secret: str
    authorize_url: str
    token_url: str
    user_info_url: str
    scope: str


class OAuthState(BaseModel):
    """OAuth state parameter."""
    provider: str
    redirect_url: Optional[str] = None
    referral_code: Optional[str] = None


# OAuth provider configurations
OAUTH_PROVIDERS = {
    "google": {
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "user_info_url": "https://www.googleapis.com/oauth2/v2/userinfo",
        "scope": "openid email profile",
        "client_id_setting": "google_oauth_client_id",
        "client_secret_setting": "google_oauth_client_secret",
    },
    "github": {
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "user_info_url": "https://api.github.com/user",
        "scope": "user:email",
        "client_id_setting": "github_oauth_client_id",
        "client_secret_setting": "github_oauth_client_secret",
    }
}


def get_oauth_config(provider: str) -> Dict[str, str]:
    """Get OAuth configuration for provider."""
    if provider not in OAUTH_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported OAuth provider: {provider}"
        )
    
    config = OAUTH_PROVIDERS[provider]
    client_id = getattr(settings, config["client_id_setting"])
    client_secret = getattr(settings, config["client_secret_setting"])
    
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"OAuth provider {provider} not configured"
        )
    
    return {
        **config,
        "client_id": client_id,
        "client_secret": client_secret
    }


@router.get("/login/{provider}")
async def oauth_login(
    provider: str,
    request: Request,
    redirect_url: Optional[str] = None,
    referral_code: Optional[str] = None
):
    """
    Initiate OAuth login flow.
    """
    config = get_oauth_config(provider)
    
    # Generate state parameter
    state_data = OAuthState(
        provider=provider,
        redirect_url=redirect_url,
        referral_code=referral_code
    )
    state = secrets.token_urlsafe(32)
    
    # Store state in session/cache (in production, use Redis)
    # For now, we'll encode it in the state parameter
    encoded_state = json.dumps(state_data.dict())
    
    # Build authorization URL
    params = {
        "client_id": config["client_id"],
        "redirect_uri": settings.oauth_redirect_url,
        "scope": config["scope"],
        "response_type": "code",
        "state": encoded_state,
    }
    
    # Add provider-specific parameters
    if provider == "google":
        params["access_type"] = "offline"
        params["prompt"] = "consent"
    
    auth_url = f"{config['authorize_url']}?{urlencode(params)}"
    
    return RedirectResponse(url=auth_url)


@router.get("/callback")
async def oauth_callback(
    code: str,
    state: str,
    request: Request,
    db: AsyncSession = Depends(get_async_session)
):
    """
    Handle OAuth callback.
    """
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authorization code not provided"
        )
    
    try:
        # Decode state
        state_data = OAuthState(**json.loads(state))
        provider = state_data.provider
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state parameter"
        )
    
    config = get_oauth_config(provider)
    
    # Exchange code for token
    async with httpx.AsyncClient() as client:
        token_data = {
            "client_id": config["client_id"],
            "client_secret": config["client_secret"],
            "code": code,
            "redirect_uri": settings.oauth_redirect_url,
        }
        
        if provider == "google":
            token_data["grant_type"] = "authorization_code"
        
        headers = {"Accept": "application/json"}
        if provider == "github":
            headers["Accept"] = "application/json"
        
        token_response = await client.post(
            config["token_url"],
            data=token_data,
            headers=headers
        )
        
        if token_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange authorization code"
            )
        
        token_info = token_response.json()
        access_token = token_info.get("access_token")
        
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No access token received"
            )
        
        # Get user info
        user_response = await client.get(
            config["user_info_url"],
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if user_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user information"
            )
        
        user_info = user_response.json()
    
    # Extract user data based on provider
    if provider == "google":
        email = user_info.get("email")
        name = user_info.get("name")
        provider_id = user_info.get("id")
        avatar_url = user_info.get("picture")
    elif provider == "github":
        email = user_info.get("email")
        name = user_info.get("name") or user_info.get("login")
        provider_id = str(user_info.get("id"))
        avatar_url = user_info.get("avatar_url")
        
        # GitHub might not provide email in the user endpoint
        if not email:
            email_response = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if email_response.status_code == 200:
                emails = email_response.json()
                primary_email = next(
                    (e for e in emails if e.get("primary")), 
                    emails[0] if emails else None
                )
                if primary_email:
                    email = primary_email["email"]
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not provided by OAuth provider"
        )
    
    # Check if user exists
    result = await db.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()
    
    if user:
        # Update OAuth provider info
        oauth_providers = user.oauth_providers or {}
        oauth_providers[provider] = {
            "id": provider_id,
            "email": email,
            "name": name,
            "avatar_url": avatar_url,
            "access_token": access_token,  # In production, encrypt this
            "updated_at": token_info.get("updated_at")
        }
        
        await db.execute(
            update(User)
            .where(User.id == user.id)
            .values(
                oauth_providers=json.dumps(oauth_providers),
                avatar_url=avatar_url or user.avatar_url,
                full_name=name or user.full_name,
                is_verified=True  # Auto-verify OAuth users
            )
        )
        await db.commit()
        await db.refresh(user)
    else:
        # Create new user
        username = email.split("@")[0]
        # Ensure username is unique
        counter = 1
        original_username = username
        while True:
            result = await db.execute(
                select(User).where(User.username == username)
            )
            if not result.scalar_one_or_none():
                break
            username = f"{original_username}{counter}"
            counter += 1
        
        oauth_providers = {
            provider: {
                "id": provider_id,
                "email": email,
                "name": name,
                "avatar_url": avatar_url,
                "access_token": access_token,
                "created_at": token_info.get("created_at")
            }
        }
        
        user = User(
            email=email,
            username=username,
            full_name=name,
            hashed_password="",  # OAuth users don't have passwords
            is_active=True,
            is_verified=True,
            avatar_url=avatar_url,
            oauth_providers=json.dumps(oauth_providers)
        )
        
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        # Handle referral if provided
        if state_data.referral_code:
            # TODO: Process referral code
            pass
    
    # Create tokens
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    
    # Create response with tokens
    response_data = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user).dict()
    }
    
    # Handle redirect
    if state_data.redirect_url:
        # In production, you'd redirect to frontend with tokens in URL params
        # or set secure HTTP-only cookies
        redirect_url = f"{state_data.redirect_url}?token={access_token}"
        return RedirectResponse(url=redirect_url)
    
    return response_data


@router.post("/link/{provider}")
async def link_oauth_provider(
    provider: str,
    code: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Link OAuth provider to existing account.
    """
    config = get_oauth_config(provider)
    
    # Exchange code for token (similar to callback)
    async with httpx.AsyncClient() as client:
        token_data = {
            "client_id": config["client_id"],
            "client_secret": config["client_secret"],
            "code": code,
            "redirect_uri": settings.oauth_redirect_url,
        }
        
        if provider == "google":
            token_data["grant_type"] = "authorization_code"
        
        token_response = await client.post(
            config["token_url"],
            data=token_data
        )
        
        if token_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange authorization code"
            )
        
        token_info = token_response.json()
        access_token = token_info.get("access_token")
        
        # Get user info
        user_response = await client.get(
            config["user_info_url"],
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        user_info = user_response.json()
    
    # Update user's OAuth providers
    oauth_providers = current_user.oauth_providers or {}
    oauth_providers[provider] = {
        "id": user_info.get("id"),
        "email": user_info.get("email"),
        "name": user_info.get("name"),
        "access_token": access_token,
        "linked_at": token_info.get("linked_at")
    }
    
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(oauth_providers=json.dumps(oauth_providers))
    )
    await db.commit()
    
    return {"message": f"{provider.title()} account linked successfully"}


@router.delete("/unlink/{provider}")
async def unlink_oauth_provider(
    provider: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session)
):
    """
    Unlink OAuth provider from account.
    """
    oauth_providers = current_user.oauth_providers or {}
    
    if provider not in oauth_providers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{provider.title()} account not linked"
        )
    
    # Remove provider
    del oauth_providers[provider]
    
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(oauth_providers=json.dumps(oauth_providers))
    )
    await db.commit()
    
    return {"message": f"{provider.title()} account unlinked successfully"}


@router.get("/providers")
async def get_linked_providers(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get user's linked OAuth providers.
    """
    oauth_providers = current_user.oauth_providers or {}
    
    # Return provider info without sensitive data
    providers = {}
    for provider, data in oauth_providers.items():
        providers[provider] = {
            "email": data.get("email"),
            "name": data.get("name"),
            "linked_at": data.get("linked_at"),
            "created_at": data.get("created_at")
        }
    
    return {"providers": providers}