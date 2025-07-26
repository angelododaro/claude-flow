"""
Notification model for comment mentions and collaboration activities.
"""

from typing import Optional
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, Boolean, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.db.base import Base


class NotificationType(str, enum.Enum):
    """Notification type enumeration."""
    COMMENT_MENTION = "comment_mention"
    COMMENT_REPLY = "comment_reply"
    COMMENT_LIKE = "comment_like"
    BOARD_SHARED = "board_shared"
    RESOURCE_SHARED = "resource_shared"
    THREAD_CREATED = "thread_created"
    THREAD_RESOLVED = "thread_resolved"
    SYSTEM_ALERT = "system_alert"


class NotificationPriority(str, enum.Enum):
    """Notification priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Notification(Base):
    """Notification model for user alerts and mentions."""
    
    __tablename__ = "notification"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4,
        index=True
    )
    
    # Notification content
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Notification metadata
    notification_type: Mapped[NotificationType] = mapped_column(
        SQLEnum(NotificationType),
        nullable=False,
        index=True
    )
    priority: Mapped[NotificationPriority] = mapped_column(
        SQLEnum(NotificationPriority),
        default=NotificationPriority.MEDIUM
    )
    
    # Context data - JSON metadata about what triggered the notification
    context_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Links to related objects
    comment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("comment.id"),
        nullable=True,
        index=True
    )
    board_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    resource_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resource.id"),
        nullable=True
    )
    
    # State
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Foreign keys
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id"),
        nullable=False,
        index=True
    )
    sender_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id"),
        nullable=True
    )
    
    # Timestamps
    read_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    dismissed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    
    # Relationships
    recipient: Mapped["User"] = relationship(
        "User",
        foreign_keys=[recipient_id],
        back_populates="notifications"
    )
    sender: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[sender_id]
    )
    comment: Mapped[Optional["Comment"]] = relationship("Comment")
    resource: Mapped[Optional["Resource"]] = relationship("Resource")
    
    def __repr__(self) -> str:
        return f"<Notification {self.id} to {self.recipient_id}>"


class NotificationPreference(Base):
    """User notification preferences."""
    
    __tablename__ = "notification_preference"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    
    # Notification settings
    notification_type: Mapped[NotificationType] = mapped_column(
        SQLEnum(NotificationType),
        nullable=False
    )
    
    # Delivery preferences
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    push_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    in_app_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Frequency settings
    immediate: Mapped[bool] = mapped_column(Boolean, default=True)
    daily_digest: Mapped[bool] = mapped_column(Boolean, default=False)
    weekly_digest: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Foreign key
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id"),
        nullable=False
    )
    
    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="notification_preferences"
    )
    
    def __repr__(self) -> str:
        return f"<NotificationPreference {self.user_id} {self.notification_type}>"