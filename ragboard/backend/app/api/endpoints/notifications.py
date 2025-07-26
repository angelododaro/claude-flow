"""
Notification management endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.api.dependencies.auth import get_current_user
from app.db.base import get_async_session
from app.models.user import User
from app.schemas.notification import (
    NotificationCreate,
    NotificationUpdate,
    NotificationResponse,
    NotificationListResponse,
    NotificationPreferenceCreate,
    NotificationPreferenceUpdate,
    NotificationPreferenceResponse,
    NotificationMarkAllReadRequest,
    NotificationBulkUpdateRequest,
    NotificationStatsResponse
)
from app.services.notification import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(False),
    notification_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """List user notifications."""
    service = NotificationService(db)
    return await service.list_notifications(
        user_id=current_user.id,
        unread_only=unread_only,
        notification_type=notification_type,
        skip=skip,
        limit=limit
    )


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get a specific notification."""
    service = NotificationService(db)
    notification = await service.get_notification(
        notification_id=notification_id,
        user_id=current_user.id
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    return notification


@router.put("/{notification_id}", response_model=NotificationResponse)
async def update_notification(
    notification_id: UUID,
    update_data: NotificationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Update notification read/dismissed status."""
    service = NotificationService(db)
    notification = await service.update_notification(
        notification_id=notification_id,
        user_id=current_user.id,
        update_data=update_data
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    return notification


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete a notification."""
    service = NotificationService(db)
    success = await service.delete_notification(
        notification_id=notification_id,
        user_id=current_user.id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    return {"message": "Notification deleted successfully"}


@router.post("/mark-all-read")
async def mark_all_read(
    request: NotificationMarkAllReadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Mark all notifications as read."""
    service = NotificationService(db)
    count = await service.mark_all_read(
        user_id=current_user.id,
        notification_type=request.notification_type
    )
    return {"message": f"Marked {count} notifications as read"}


@router.post("/bulk-update")
async def bulk_update_notifications(
    request: NotificationBulkUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Bulk update notifications."""
    service = NotificationService(db)
    count = await service.bulk_update_notifications(
        notification_ids=request.notification_ids,
        user_id=current_user.id,
        is_read=request.is_read,
        is_dismissed=request.is_dismissed
    )
    return {"message": f"Updated {count} notifications"}


@router.get("/stats/overview", response_model=NotificationStatsResponse)
async def get_notification_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get notification statistics."""
    service = NotificationService(db)
    return await service.get_notification_stats(user_id=current_user.id)


# Notification Preferences endpoints
@router.get("/preferences/", response_model=List[NotificationPreferenceResponse])
async def list_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """List user notification preferences."""
    service = NotificationService(db)
    return await service.list_preferences(user_id=current_user.id)


@router.post("/preferences/", response_model=NotificationPreferenceResponse)
async def create_notification_preference(
    preference_data: NotificationPreferenceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Create or update a notification preference."""
    service = NotificationService(db)
    preference = await service.create_or_update_preference(
        user_id=current_user.id,
        preference_data=preference_data
    )
    return preference


@router.put("/preferences/{preference_id}", response_model=NotificationPreferenceResponse)
async def update_notification_preference(
    preference_id: UUID,
    preference_data: NotificationPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Update a notification preference."""
    service = NotificationService(db)
    preference = await service.update_preference(
        preference_id=preference_id,
        user_id=current_user.id,
        preference_data=preference_data
    )
    if not preference:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preference not found"
        )
    return preference


@router.delete("/preferences/{preference_id}")
async def delete_notification_preference(
    preference_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete a notification preference."""
    service = NotificationService(db)
    success = await service.delete_preference(
        preference_id=preference_id,
        user_id=current_user.id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preference not found"
        )
    return {"message": "Preference deleted successfully"}


# Real-time notification endpoints
@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get count of unread notifications."""
    service = NotificationService(db)
    count = await service.get_unread_count(user_id=current_user.id)
    return {"unread_count": count}


@router.get("/recent")
async def get_recent_notifications(
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get recent notifications for real-time updates."""
    service = NotificationService(db)
    notifications = await service.get_recent_notifications(
        user_id=current_user.id,
        limit=limit
    )
    return {"notifications": notifications}