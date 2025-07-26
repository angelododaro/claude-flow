"""
Notification schemas for API requests and responses.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict

from app.models.notification import NotificationType, NotificationPriority


class NotificationBase(BaseModel):
    """Base notification schema."""
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    notification_type: NotificationType
    priority: NotificationPriority = Field(default=NotificationPriority.MEDIUM)
    context_data: Optional[Dict[str, Any]] = None


class NotificationCreate(NotificationBase):
    """Schema for creating a notification."""
    recipient_id: UUID
    comment_id: Optional[UUID] = None
    board_id: Optional[str] = None
    resource_id: Optional[UUID] = None
    expires_at: Optional[datetime] = None


class NotificationUpdate(BaseModel):
    """Schema for updating a notification."""
    is_read: Optional[bool] = None
    is_dismissed: Optional[bool] = None


class NotificationResponse(BaseModel):
    """Schema for notification response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    title: str
    message: str
    notification_type: NotificationType
    priority: NotificationPriority
    context_data: Optional[Dict[str, Any]]
    comment_id: Optional[UUID]
    board_id: Optional[str]
    resource_id: Optional[UUID]
    is_read: bool
    is_dismissed: bool
    recipient_id: UUID
    sender_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    read_at: Optional[datetime]
    dismissed_at: Optional[datetime]
    expires_at: Optional[datetime]
    
    # Optional sender info
    sender: Optional[Dict[str, Any]] = None


class NotificationListResponse(BaseModel):
    """Schema for paginated notification list."""
    notifications: List[NotificationResponse]
    total: int
    unread_count: int
    skip: int
    limit: int


class NotificationPreferenceBase(BaseModel):
    """Base notification preference schema."""
    notification_type: NotificationType
    email_enabled: bool = Field(default=True)
    push_enabled: bool = Field(default=True)
    in_app_enabled: bool = Field(default=True)
    immediate: bool = Field(default=True)
    daily_digest: bool = Field(default=False)
    weekly_digest: bool = Field(default=False)


class NotificationPreferenceCreate(NotificationPreferenceBase):
    """Schema for creating notification preferences."""
    pass


class NotificationPreferenceUpdate(BaseModel):
    """Schema for updating notification preferences."""
    email_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    in_app_enabled: Optional[bool] = None
    immediate: Optional[bool] = None
    daily_digest: Optional[bool] = None
    weekly_digest: Optional[bool] = None


class NotificationPreferenceResponse(BaseModel):
    """Schema for notification preference response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    notification_type: NotificationType
    email_enabled: bool
    push_enabled: bool
    in_app_enabled: bool
    immediate: bool
    daily_digest: bool
    weekly_digest: bool
    user_id: UUID
    created_at: datetime
    updated_at: datetime


class NotificationMarkAllReadRequest(BaseModel):
    """Schema for marking all notifications as read."""
    notification_type: Optional[NotificationType] = None


class NotificationBulkUpdateRequest(BaseModel):
    """Schema for bulk notification updates."""
    notification_ids: List[UUID]
    is_read: Optional[bool] = None
    is_dismissed: Optional[bool] = None


class NotificationStatsResponse(BaseModel):
    """Schema for notification statistics."""
    total_notifications: int
    unread_notifications: int
    notifications_by_type: Dict[str, int]
    recent_activity: List[Dict[str, Any]]