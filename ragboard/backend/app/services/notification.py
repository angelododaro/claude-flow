"""
Notification service for handling notification-related business logic.
"""

import json
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, or_
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.models.notification import (
    Notification,
    NotificationPreference,
    NotificationType,
    NotificationPriority
)
from app.models.comment import Comment
from app.models.user import User
from app.schemas.notification import (
    NotificationCreate,
    NotificationUpdate,
    NotificationResponse,
    NotificationListResponse,
    NotificationPreferenceCreate,
    NotificationPreferenceUpdate,
    NotificationPreferenceResponse,
    NotificationStatsResponse
)


class NotificationService:
    """Service for notification operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_notification(
        self,
        notification_data: NotificationCreate
    ) -> NotificationResponse:
        """Create a new notification."""
        # Convert context data to JSON
        context_json = None
        if notification_data.context_data:
            context_json = json.dumps(notification_data.context_data)
        
        notification = Notification(
            title=notification_data.title,
            message=notification_data.message,
            notification_type=notification_data.notification_type,
            priority=notification_data.priority,
            context_data=context_json,
            recipient_id=notification_data.recipient_id,
            comment_id=notification_data.comment_id,
            board_id=notification_data.board_id,
            resource_id=notification_data.resource_id,
            expires_at=notification_data.expires_at
        )
        
        self.db.add(notification)
        await self.db.commit()
        
        return await self._convert_to_response(notification)
    
    async def get_notification(
        self,
        notification_id: UUID,
        user_id: UUID
    ) -> Optional[NotificationResponse]:
        """Get a notification by ID."""
        result = await self.db.execute(
            select(Notification)
            .options(selectinload(Notification.sender))
            .where(
                and_(
                    Notification.id == notification_id,
                    Notification.recipient_id == user_id
                )
            )
        )
        notification = result.scalar_one_or_none()
        
        if not notification:
            return None
        
        return await self._convert_to_response(notification)
    
    async def list_notifications(
        self,
        user_id: UUID,
        unread_only: bool = False,
        notification_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 20
    ) -> NotificationListResponse:
        """List user notifications."""
        query = select(Notification).options(
            selectinload(Notification.sender)
        ).where(Notification.recipient_id == user_id)
        
        # Apply filters
        if unread_only:
            query = query.where(Notification.is_read == False)
        if notification_type:
            query = query.where(Notification.notification_type == notification_type)
        
        # Filter out expired notifications
        query = query.where(
            or_(
                Notification.expires_at.is_(None),
                Notification.expires_at > datetime.utcnow()
            )
        )
        
        # Order by creation date (newest first)
        query = query.order_by(desc(Notification.created_at))
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()
        
        # Get unread count
        unread_query = select(func.count()).where(
            and_(
                Notification.recipient_id == user_id,
                Notification.is_read == False,
                or_(
                    Notification.expires_at.is_(None),
                    Notification.expires_at > datetime.utcnow()
                )
            )
        )
        unread_result = await self.db.execute(unread_query)
        unread_count = unread_result.scalar()
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        # Execute query
        result = await self.db.execute(query)
        notifications = result.scalars().all()
        
        # Convert to response models
        notification_responses = []
        for notification in notifications:
            notification_response = await self._convert_to_response(notification)
            notification_responses.append(notification_response)
        
        return NotificationListResponse(
            notifications=notification_responses,
            total=total,
            unread_count=unread_count,
            skip=skip,
            limit=limit
        )
    
    async def update_notification(
        self,
        notification_id: UUID,
        user_id: UUID,
        update_data: NotificationUpdate
    ) -> Optional[NotificationResponse]:
        """Update notification read/dismissed status."""
        result = await self.db.execute(
            select(Notification).where(
                and_(
                    Notification.id == notification_id,
                    Notification.recipient_id == user_id
                )
            )
        )
        notification = result.scalar_one_or_none()
        
        if not notification:
            return None
        
        # Update fields
        if update_data.is_read is not None:
            notification.is_read = update_data.is_read
            if update_data.is_read and not notification.read_at:
                notification.read_at = datetime.utcnow()
            elif not update_data.is_read:
                notification.read_at = None
        
        if update_data.is_dismissed is not None:
            notification.is_dismissed = update_data.is_dismissed
            if update_data.is_dismissed and not notification.dismissed_at:
                notification.dismissed_at = datetime.utcnow()
            elif not update_data.is_dismissed:
                notification.dismissed_at = None
        
        await self.db.commit()
        
        return await self._convert_to_response(notification)
    
    async def delete_notification(
        self,
        notification_id: UUID,
        user_id: UUID
    ) -> bool:
        """Delete a notification."""
        result = await self.db.execute(
            select(Notification).where(
                and_(
                    Notification.id == notification_id,
                    Notification.recipient_id == user_id
                )
            )
        )
        notification = result.scalar_one_or_none()
        
        if not notification:
            return False
        
        await self.db.delete(notification)
        await self.db.commit()
        return True
    
    async def mark_all_read(
        self,
        user_id: UUID,
        notification_type: Optional[NotificationType] = None
    ) -> int:
        """Mark all notifications as read for a user."""
        query = select(Notification).where(
            and_(
                Notification.recipient_id == user_id,
                Notification.is_read == False
            )
        )
        
        if notification_type:
            query = query.where(Notification.notification_type == notification_type)
        
        result = await self.db.execute(query)
        notifications = result.scalars().all()
        
        count = 0
        for notification in notifications:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            count += 1
        
        await self.db.commit()
        return count
    
    async def bulk_update_notifications(
        self,
        notification_ids: List[UUID],
        user_id: UUID,
        is_read: Optional[bool] = None,
        is_dismissed: Optional[bool] = None
    ) -> int:
        """Bulk update notifications."""
        query = select(Notification).where(
            and_(
                Notification.id.in_(notification_ids),
                Notification.recipient_id == user_id
            )
        )
        
        result = await self.db.execute(query)
        notifications = result.scalars().all()
        
        count = 0
        for notification in notifications:
            if is_read is not None:
                notification.is_read = is_read
                if is_read and not notification.read_at:
                    notification.read_at = datetime.utcnow()
                elif not is_read:
                    notification.read_at = None
            
            if is_dismissed is not None:
                notification.is_dismissed = is_dismissed
                if is_dismissed and not notification.dismissed_at:
                    notification.dismissed_at = datetime.utcnow()
                elif not is_dismissed:
                    notification.dismissed_at = None
            
            count += 1
        
        await self.db.commit()
        return count
    
    async def get_unread_count(self, user_id: UUID) -> int:
        """Get count of unread notifications for a user."""
        result = await self.db.execute(
            select(func.count()).where(
                and_(
                    Notification.recipient_id == user_id,
                    Notification.is_read == False,
                    or_(
                        Notification.expires_at.is_(None),
                        Notification.expires_at > datetime.utcnow()
                    )
                )
            )
        )
        return result.scalar()
    
    async def get_recent_notifications(
        self,
        user_id: UUID,
        limit: int = 5
    ) -> List[NotificationResponse]:
        """Get recent notifications for real-time updates."""
        result = await self.db.execute(
            select(Notification)
            .options(selectinload(Notification.sender))
            .where(Notification.recipient_id == user_id)
            .where(
                or_(
                    Notification.expires_at.is_(None),
                    Notification.expires_at > datetime.utcnow()
                )
            )
            .order_by(desc(Notification.created_at))
            .limit(limit)
        )
        notifications = result.scalars().all()
        
        notification_responses = []
        for notification in notifications:
            notification_response = await self._convert_to_response(notification)
            notification_responses.append(notification_response)
        
        return notification_responses
    
    async def get_notification_stats(
        self,
        user_id: UUID
    ) -> NotificationStatsResponse:
        """Get notification statistics for a user."""
        # Total notifications
        total_result = await self.db.execute(
            select(func.count()).where(Notification.recipient_id == user_id)
        )
        total_notifications = total_result.scalar()
        
        # Unread notifications
        unread_result = await self.db.execute(
            select(func.count()).where(
                and_(
                    Notification.recipient_id == user_id,
                    Notification.is_read == False
                )
            )
        )
        unread_notifications = unread_result.scalar()
        
        # Notifications by type
        type_result = await self.db.execute(
            select(Notification.notification_type, func.count(Notification.id))
            .where(Notification.recipient_id == user_id)
            .group_by(Notification.notification_type)
        )
        notifications_by_type = {row[0]: row[1] for row in type_result}
        
        # Recent activity (last 7 days)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        activity_result = await self.db.execute(
            select(Notification.notification_type, func.count(Notification.id))
            .where(
                and_(
                    Notification.recipient_id == user_id,
                    Notification.created_at >= seven_days_ago
                )
            )
            .group_by(Notification.notification_type)
        )
        recent_activity = [
            {"type": row[0], "count": row[1]}
            for row in activity_result
        ]
        
        return NotificationStatsResponse(
            total_notifications=total_notifications,
            unread_notifications=unread_notifications,
            notifications_by_type=notifications_by_type,
            recent_activity=recent_activity
        )
    
    # Notification Preferences
    async def list_preferences(
        self,
        user_id: UUID
    ) -> List[NotificationPreferenceResponse]:
        """List user notification preferences."""
        result = await self.db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user_id
            )
        )
        preferences = result.scalars().all()
        
        return [self._convert_preference_to_response(pref) for pref in preferences]
    
    async def create_or_update_preference(
        self,
        user_id: UUID,
        preference_data: NotificationPreferenceCreate
    ) -> NotificationPreferenceResponse:
        """Create or update a notification preference."""
        # Check if preference already exists
        result = await self.db.execute(
            select(NotificationPreference).where(
                and_(
                    NotificationPreference.user_id == user_id,
                    NotificationPreference.notification_type == preference_data.notification_type
                )
            )
        )
        preference = result.scalar_one_or_none()
        
        if preference:
            # Update existing preference
            preference.email_enabled = preference_data.email_enabled
            preference.push_enabled = preference_data.push_enabled
            preference.in_app_enabled = preference_data.in_app_enabled
            preference.immediate = preference_data.immediate
            preference.daily_digest = preference_data.daily_digest
            preference.weekly_digest = preference_data.weekly_digest
        else:
            # Create new preference
            preference = NotificationPreference(
                user_id=user_id,
                notification_type=preference_data.notification_type,
                email_enabled=preference_data.email_enabled,
                push_enabled=preference_data.push_enabled,
                in_app_enabled=preference_data.in_app_enabled,
                immediate=preference_data.immediate,
                daily_digest=preference_data.daily_digest,
                weekly_digest=preference_data.weekly_digest
            )
            self.db.add(preference)
        
        await self.db.commit()
        return self._convert_preference_to_response(preference)
    
    async def update_preference(
        self,
        preference_id: UUID,
        user_id: UUID,
        preference_data: NotificationPreferenceUpdate
    ) -> Optional[NotificationPreferenceResponse]:
        """Update a notification preference."""
        result = await self.db.execute(
            select(NotificationPreference).where(
                and_(
                    NotificationPreference.id == preference_id,
                    NotificationPreference.user_id == user_id
                )
            )
        )
        preference = result.scalar_one_or_none()
        
        if not preference:
            return None
        
        # Update fields
        if preference_data.email_enabled is not None:
            preference.email_enabled = preference_data.email_enabled
        if preference_data.push_enabled is not None:
            preference.push_enabled = preference_data.push_enabled
        if preference_data.in_app_enabled is not None:
            preference.in_app_enabled = preference_data.in_app_enabled
        if preference_data.immediate is not None:
            preference.immediate = preference_data.immediate
        if preference_data.daily_digest is not None:
            preference.daily_digest = preference_data.daily_digest
        if preference_data.weekly_digest is not None:
            preference.weekly_digest = preference_data.weekly_digest
        
        await self.db.commit()
        return self._convert_preference_to_response(preference)
    
    async def delete_preference(
        self,
        preference_id: UUID,
        user_id: UUID
    ) -> bool:
        """Delete a notification preference."""
        result = await self.db.execute(
            select(NotificationPreference).where(
                and_(
                    NotificationPreference.id == preference_id,
                    NotificationPreference.user_id == user_id
                )
            )
        )
        preference = result.scalar_one_or_none()
        
        if not preference:
            return False
        
        await self.db.delete(preference)
        await self.db.commit()
        return True
    
    # Specialized notification creation methods
    async def notify_mention(
        self,
        comment: Comment,
        mentioned_users: List[UUID],
        sender: User
    ):
        """Create mention notifications."""
        for user_id in mentioned_users:
            notification_data = NotificationCreate(
                title=f"You were mentioned by {sender.username}",
                message=f"{sender.username} mentioned you in a comment: \"{comment.content[:100]}...\"",
                notification_type=NotificationType.COMMENT_MENTION,
                priority=NotificationPriority.HIGH,
                recipient_id=user_id,
                comment_id=comment.id,
                board_id=comment.board_id,
                resource_id=comment.resource_id,
                context_data={
                    "comment_id": str(comment.id),
                    "sender_username": sender.username,
                    "board_id": comment.board_id,
                    "resource_id": str(comment.resource_id) if comment.resource_id else None
                }
            )
            await self.create_notification(notification_data)
    
    async def notify_comment_reply(
        self,
        comment: Comment,
        parent_comment: Comment,
        sender: User
    ):
        """Create reply notifications."""
        if parent_comment.author_id != comment.author_id:  # Don't notify self
            notification_data = NotificationCreate(
                title=f"New reply to your comment",
                message=f"{sender.username} replied to your comment: \"{comment.content[:100]}...\"",
                notification_type=NotificationType.COMMENT_REPLY,
                priority=NotificationPriority.MEDIUM,
                recipient_id=parent_comment.author_id,
                comment_id=comment.id,
                board_id=comment.board_id,
                resource_id=comment.resource_id,
                context_data={
                    "comment_id": str(comment.id),
                    "parent_comment_id": str(parent_comment.id),
                    "sender_username": sender.username
                }
            )
            await self.create_notification(notification_data)
    
    async def notify_comment_like(
        self,
        comment: Comment,
        user: User
    ):
        """Create like notifications."""
        if comment.author_id != user.id:  # Don't notify self
            notification_data = NotificationCreate(
                title=f"{user.username} liked your comment",
                message=f"{user.username} liked your comment: \"{comment.content[:100]}...\"",
                notification_type=NotificationType.COMMENT_LIKE,
                priority=NotificationPriority.LOW,
                recipient_id=comment.author_id,
                comment_id=comment.id,
                board_id=comment.board_id,
                resource_id=comment.resource_id,
                context_data={
                    "comment_id": str(comment.id),
                    "liker_username": user.username
                }
            )
            await self.create_notification(notification_data)
    
    # Helper methods
    async def _convert_to_response(
        self,
        notification: Notification
    ) -> NotificationResponse:
        """Convert Notification model to NotificationResponse."""
        # Parse context data
        context_data = None
        if notification.context_data:
            try:
                context_data = json.loads(notification.context_data)
            except json.JSONDecodeError:
                pass
        
        # Include sender info if available
        sender_info = None
        if notification.sender:
            sender_info = {
                "id": str(notification.sender.id),
                "username": notification.sender.username,
                "full_name": notification.sender.full_name,
                "avatar_url": notification.sender.avatar_url
            }
        
        return NotificationResponse(
            id=notification.id,
            title=notification.title,
            message=notification.message,
            notification_type=notification.notification_type,
            priority=notification.priority,
            context_data=context_data,
            comment_id=notification.comment_id,
            board_id=notification.board_id,
            resource_id=notification.resource_id,
            is_read=notification.is_read,
            is_dismissed=notification.is_dismissed,
            recipient_id=notification.recipient_id,
            sender_id=notification.sender_id,
            created_at=notification.created_at,
            updated_at=notification.updated_at,
            read_at=notification.read_at,
            dismissed_at=notification.dismissed_at,
            expires_at=notification.expires_at,
            sender=sender_info
        )
    
    def _convert_preference_to_response(
        self,
        preference: NotificationPreference
    ) -> NotificationPreferenceResponse:
        """Convert NotificationPreference model to response."""
        return NotificationPreferenceResponse(
            id=preference.id,
            notification_type=preference.notification_type,
            email_enabled=preference.email_enabled,
            push_enabled=preference.push_enabled,
            in_app_enabled=preference.in_app_enabled,
            immediate=preference.immediate,
            daily_digest=preference.daily_digest,
            weekly_digest=preference.weekly_digest,
            user_id=preference.user_id,
            created_at=preference.created_at,
            updated_at=preference.updated_at
        )