"""
Comment service for handling comment-related business logic.
"""

import json
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, desc, text
from sqlalchemy.orm import selectinload, joinedload
from uuid import UUID

from app.models.comment import Comment, CommentLike, CommentThread, CommentStatus, CommentType
from app.models.user import User
from app.schemas.comment import (
    CommentCreate,
    CommentUpdate,
    CommentResponse,
    CommentListResponse,
    CommentThreadCreate,
    CommentThreadUpdate,
    CommentThreadResponse,
    CommentSearchRequest,
    CommentStatsResponse
)


class CommentService:
    """Service for comment operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_comment(
        self, 
        author_id: UUID, 
        comment_data: CommentCreate
    ) -> CommentResponse:
        """Create a new comment."""
        # Handle threading
        parent_comment = None
        thread_id = None
        depth = 0
        
        if comment_data.parent_id:
            # Get parent comment for threading
            parent_result = await self.db.execute(
                select(Comment).where(Comment.id == comment_data.parent_id)
            )
            parent_comment = parent_result.scalar_one_or_none()
            if parent_comment:
                depth = parent_comment.depth + 1
                thread_id = parent_comment.thread_id or parent_comment.id
        
        # Convert mentioned users to JSON
        mentioned_users_json = None
        if comment_data.mentioned_users:
            mentioned_users_json = json.dumps([str(uid) for uid in comment_data.mentioned_users])
        
        # Create comment
        comment = Comment(
            content=comment_data.content,
            content_type=comment_data.content_type,
            comment_type=comment_data.comment_type,
            board_id=comment_data.board_id,
            resource_id=comment_data.resource_id,
            frame_id=comment_data.frame_id,
            card_id=comment_data.card_id,
            position_x=comment_data.position_x,
            position_y=comment_data.position_y,
            parent_id=comment_data.parent_id,
            thread_id=thread_id,
            depth=depth,
            mentioned_users=mentioned_users_json,
            is_private=comment_data.is_private,
            author_id=author_id
        )
        
        self.db.add(comment)
        await self.db.flush()
        
        # Update parent's reply count
        if parent_comment:
            parent_comment.replies_count += 1
        
        # Update thread's comment count
        if thread_id:
            thread_result = await self.db.execute(
                select(CommentThread).where(CommentThread.id == thread_id)
            )
            thread = thread_result.scalar_one_or_none()
            if thread:
                thread.comments_count += 1
                thread.last_activity_at = datetime.utcnow()
        
        await self.db.commit()
        
        # Return with relationships loaded
        return await self._get_comment_with_relations(comment.id)
    
    async def get_comment(
        self, 
        comment_id: UUID, 
        include_replies: bool = True,
        current_user_id: Optional[UUID] = None
    ) -> Optional[CommentResponse]:
        """Get a comment by ID."""
        return await self._get_comment_with_relations(
            comment_id, 
            include_replies=include_replies,
            current_user_id=current_user_id
        )
    
    async def list_comments(
        self,
        board_id: Optional[str] = None,
        resource_id: Optional[UUID] = None,
        parent_id: Optional[UUID] = None,
        thread_id: Optional[UUID] = None,
        author_id: Optional[UUID] = None,
        comment_type: Optional[str] = None,
        is_resolved: Optional[bool] = None,
        skip: int = 0,
        limit: int = 20,
        current_user_id: Optional[UUID] = None
    ) -> CommentListResponse:
        """List comments with filtering."""
        # Build query
        query = select(Comment).options(
            selectinload(Comment.author),
            selectinload(Comment.likes),
            selectinload(Comment.replies)
        )
        
        # Apply filters
        if board_id:
            query = query.where(Comment.board_id == board_id)
        if resource_id:
            query = query.where(Comment.resource_id == resource_id)
        if parent_id:
            query = query.where(Comment.parent_id == parent_id)
        if thread_id:
            query = query.where(Comment.thread_id == thread_id)
        if author_id:
            query = query.where(Comment.author_id == author_id)
        if comment_type:
            query = query.where(Comment.comment_type == comment_type)
        if is_resolved is not None:
            query = query.where(Comment.is_resolved == is_resolved)
        
        # Filter out deleted comments
        query = query.where(Comment.status != CommentStatus.DELETED)
        
        # Order by creation date
        query = query.order_by(desc(Comment.created_at))
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        # Execute query
        result = await self.db.execute(query)
        comments = result.scalars().all()
        
        # Convert to response models
        comment_responses = []
        for comment in comments:
            comment_response = await self._convert_to_response(
                comment, 
                current_user_id=current_user_id
            )
            comment_responses.append(comment_response)
        
        return CommentListResponse(
            comments=comment_responses,
            total=total,
            skip=skip,
            limit=limit,
            has_more=(skip + limit) < total
        )
    
    async def update_comment(
        self,
        comment_id: UUID,
        comment_data: CommentUpdate,
        current_user_id: UUID
    ) -> Optional[CommentResponse]:
        """Update a comment."""
        # Get comment
        result = await self.db.execute(
            select(Comment).where(Comment.id == comment_id)
        )
        comment = result.scalar_one_or_none()
        
        if not comment or comment.author_id != current_user_id:
            return None
        
        # Update fields
        if comment_data.content is not None:
            comment.content = comment_data.content
            comment.edited_at = datetime.utcnow()
        if comment_data.comment_type is not None:
            comment.comment_type = comment_data.comment_type
        if comment_data.is_resolved is not None:
            comment.is_resolved = comment_data.is_resolved
        if comment_data.is_pinned is not None:
            comment.is_pinned = comment_data.is_pinned
        if comment_data.is_private is not None:
            comment.is_private = comment_data.is_private
        
        await self.db.commit()
        
        return await self._get_comment_with_relations(comment_id)
    
    async def delete_comment(
        self,
        comment_id: UUID,
        current_user_id: UUID
    ) -> bool:
        """Delete a comment (soft delete)."""
        # Get comment
        result = await self.db.execute(
            select(Comment).where(Comment.id == comment_id)
        )
        comment = result.scalar_one_or_none()
        
        if not comment or comment.author_id != current_user_id:
            return False
        
        # Soft delete
        comment.status = CommentStatus.DELETED
        comment.content = "[deleted]"
        
        await self.db.commit()
        return True
    
    async def toggle_like(
        self,
        comment_id: UUID,
        user_id: UUID,
        reaction_type: str = "like"
    ) -> Dict[str, Any]:
        """Toggle like on a comment."""
        # Check if like exists
        result = await self.db.execute(
            select(CommentLike).where(
                and_(
                    CommentLike.comment_id == comment_id,
                    CommentLike.user_id == user_id
                )
            )
        )
        existing_like = result.scalar_one_or_none()
        
        if existing_like:
            # Remove like
            await self.db.delete(existing_like)
            
            # Update comment likes count
            comment_result = await self.db.execute(
                select(Comment).where(Comment.id == comment_id)
            )
            comment = comment_result.scalar_one_or_none()
            if comment:
                comment.likes_count = max(0, comment.likes_count - 1)
            
            await self.db.commit()
            return {"liked": False, "reaction_type": None}
        else:
            # Add like
            like = CommentLike(
                comment_id=comment_id,
                user_id=user_id,
                reaction_type=reaction_type
            )
            self.db.add(like)
            
            # Update comment likes count
            comment_result = await self.db.execute(
                select(Comment).where(Comment.id == comment_id)
            )
            comment = comment_result.scalar_one_or_none()
            if comment:
                comment.likes_count += 1
            
            await self.db.commit()
            return {"liked": True, "reaction_type": reaction_type}
    
    async def unlike_comment(
        self,
        comment_id: UUID,
        user_id: UUID
    ) -> bool:
        """Remove like from a comment."""
        result = await self.db.execute(
            select(CommentLike).where(
                and_(
                    CommentLike.comment_id == comment_id,
                    CommentLike.user_id == user_id
                )
            )
        )
        like = result.scalar_one_or_none()
        
        if not like:
            return False
        
        await self.db.delete(like)
        
        # Update comment likes count
        comment_result = await self.db.execute(
            select(Comment).where(Comment.id == comment_id)
        )
        comment = comment_result.scalar_one_or_none()
        if comment:
            comment.likes_count = max(0, comment.likes_count - 1)
        
        await self.db.commit()
        return True
    
    async def resolve_comment(
        self,
        comment_id: UUID,
        resolved_by_id: UUID
    ) -> Optional[CommentResponse]:
        """Mark a comment as resolved."""
        result = await self.db.execute(
            select(Comment).where(Comment.id == comment_id)
        )
        comment = result.scalar_one_or_none()
        
        if not comment:
            return None
        
        comment.is_resolved = True
        comment.resolved_by_id = resolved_by_id
        comment.resolved_at = datetime.utcnow()
        
        await self.db.commit()
        
        return await self._get_comment_with_relations(comment_id)
    
    async def unresolve_comment(
        self,
        comment_id: UUID
    ) -> Optional[CommentResponse]:
        """Mark a comment as unresolved."""
        result = await self.db.execute(
            select(Comment).where(Comment.id == comment_id)
        )
        comment = result.scalar_one_or_none()
        
        if not comment:
            return None
        
        comment.is_resolved = False
        comment.resolved_by_id = None
        comment.resolved_at = None
        
        await self.db.commit()
        
        return await self._get_comment_with_relations(comment_id)
    
    # Thread methods
    async def create_thread(
        self,
        created_by_id: UUID,
        thread_data: CommentThreadCreate
    ) -> CommentThreadResponse:
        """Create a new comment thread."""
        thread = CommentThread(
            title=thread_data.title,
            description=thread_data.description,
            board_id=thread_data.board_id,
            resource_id=thread_data.resource_id,
            created_by_id=created_by_id,
            last_activity_at=datetime.utcnow()
        )
        
        self.db.add(thread)
        await self.db.commit()
        
        return await self._get_thread_with_relations(thread.id)
    
    async def get_thread(
        self,
        thread_id: UUID,
        include_comments: bool = True
    ) -> Optional[CommentThreadResponse]:
        """Get a thread by ID."""
        return await self._get_thread_with_relations(
            thread_id,
            include_comments=include_comments
        )
    
    async def list_threads(
        self,
        board_id: Optional[str] = None,
        resource_id: Optional[UUID] = None,
        is_resolved: Optional[bool] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[CommentThreadResponse]:
        """List comment threads."""
        query = select(CommentThread).options(
            selectinload(CommentThread.created_by)
        )
        
        if board_id:
            query = query.where(CommentThread.board_id == board_id)
        if resource_id:
            query = query.where(CommentThread.resource_id == resource_id)
        if is_resolved is not None:
            query = query.where(CommentThread.is_resolved == is_resolved)
        
        query = query.order_by(desc(CommentThread.last_activity_at))
        query = query.offset(skip).limit(limit)
        
        result = await self.db.execute(query)
        threads = result.scalars().all()
        
        # Convert to response models
        thread_responses = []
        for thread in threads:
            thread_response = await self._convert_thread_to_response(thread)
            thread_responses.append(thread_response)
        
        return thread_responses
    
    async def update_thread(
        self,
        thread_id: UUID,
        thread_data: CommentThreadUpdate,
        current_user_id: UUID
    ) -> Optional[CommentThreadResponse]:
        """Update a comment thread."""
        result = await self.db.execute(
            select(CommentThread).where(CommentThread.id == thread_id)
        )
        thread = result.scalar_one_or_none()
        
        if not thread or thread.created_by_id != current_user_id:
            return None
        
        # Update fields
        if thread_data.title is not None:
            thread.title = thread_data.title
        if thread_data.description is not None:
            thread.description = thread_data.description
        if thread_data.is_locked is not None:
            thread.is_locked = thread_data.is_locked
        if thread_data.is_resolved is not None:
            thread.is_resolved = thread_data.is_resolved
        if thread_data.is_pinned is not None:
            thread.is_pinned = thread_data.is_pinned
        
        await self.db.commit()
        
        return await self._get_thread_with_relations(thread_id)
    
    async def delete_thread(
        self,
        thread_id: UUID,
        current_user_id: UUID
    ) -> bool:
        """Delete a comment thread."""
        result = await self.db.execute(
            select(CommentThread).where(CommentThread.id == thread_id)
        )
        thread = result.scalar_one_or_none()
        
        if not thread or thread.created_by_id != current_user_id:
            return False
        
        await self.db.delete(thread)
        await self.db.commit()
        return True
    
    async def search_comments(
        self,
        search_request: CommentSearchRequest,
        current_user_id: Optional[UUID] = None
    ) -> CommentListResponse:
        """Search comments with advanced filters."""
        query = select(Comment).options(
            selectinload(Comment.author),
            selectinload(Comment.likes)
        )
        
        # Text search
        if search_request.query:
            query = query.where(
                Comment.content.ilike(f"%{search_request.query}%")
            )
        
        # Apply filters
        if search_request.board_id:
            query = query.where(Comment.board_id == search_request.board_id)
        if search_request.resource_id:
            query = query.where(Comment.resource_id == search_request.resource_id)
        if search_request.comment_type:
            query = query.where(Comment.comment_type == search_request.comment_type)
        if search_request.author_id:
            query = query.where(Comment.author_id == search_request.author_id)
        if search_request.is_resolved is not None:
            query = query.where(Comment.is_resolved == search_request.is_resolved)
        if search_request.date_from:
            query = query.where(Comment.created_at >= search_request.date_from)
        if search_request.date_to:
            query = query.where(Comment.created_at <= search_request.date_to)
        
        # Filter out deleted comments
        query = query.where(Comment.status != CommentStatus.DELETED)
        
        # Order by relevance and date
        query = query.order_by(desc(Comment.created_at))
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination
        query = query.offset(search_request.skip).limit(search_request.limit)
        
        # Execute query
        result = await self.db.execute(query)
        comments = result.scalars().all()
        
        # Convert to response models
        comment_responses = []
        for comment in comments:
            comment_response = await self._convert_to_response(
                comment,
                current_user_id=current_user_id
            )
            comment_responses.append(comment_response)
        
        return CommentListResponse(
            comments=comment_responses,
            total=total,
            skip=search_request.skip,
            limit=search_request.limit,
            has_more=(search_request.skip + search_request.limit) < total
        )
    
    async def get_comment_stats(
        self,
        board_id: Optional[str] = None,
        resource_id: Optional[UUID] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
    ) -> CommentStatsResponse:
        """Get comment statistics."""
        # Base query
        base_query = select(Comment).where(Comment.status != CommentStatus.DELETED)
        
        if board_id:
            base_query = base_query.where(Comment.board_id == board_id)
        if resource_id:
            base_query = base_query.where(Comment.resource_id == resource_id)
        if date_from:
            base_query = base_query.where(Comment.created_at >= date_from)
        if date_to:
            base_query = base_query.where(Comment.created_at <= date_to)
        
        # Total comments
        total_result = await self.db.execute(
            select(func.count()).select_from(base_query.subquery())
        )
        total_comments = total_result.scalar()
        
        # Resolved comments
        resolved_result = await self.db.execute(
            select(func.count()).select_from(
                base_query.where(Comment.is_resolved == True).subquery()
            )
        )
        resolved_comments = resolved_result.scalar()
        
        # Pending comments
        pending_comments = total_comments - resolved_comments
        
        # Comments by type
        type_result = await self.db.execute(
            select(Comment.comment_type, func.count(Comment.id))
            .where(Comment.status != CommentStatus.DELETED)
            .group_by(Comment.comment_type)
        )
        comments_by_type = {row[0]: row[1] for row in type_result}
        
        # Top contributors (authors with most comments)
        contributors_result = await self.db.execute(
            select(User.username, User.full_name, func.count(Comment.id))
            .join(Comment, User.id == Comment.author_id)
            .where(Comment.status != CommentStatus.DELETED)
            .group_by(User.id, User.username, User.full_name)
            .order_by(desc(func.count(Comment.id)))
            .limit(10)
        )
        top_contributors = [
            {
                "username": row[0],
                "full_name": row[1],
                "comment_count": row[2]
            }
            for row in contributors_result
        ]
        
        # Activity timeline (comments per day for last 30 days)
        timeline_result = await self.db.execute(
            text("""
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM comment 
                WHERE status != 'deleted' 
                  AND created_at >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(created_at)
                ORDER BY date
            """)
        )
        activity_timeline = [
            {"date": str(row[0]), "count": row[1]}
            for row in timeline_result
        ]
        
        return CommentStatsResponse(
            total_comments=total_comments,
            resolved_comments=resolved_comments,
            pending_comments=pending_comments,
            comments_by_type=comments_by_type,
            top_contributors=top_contributors,
            activity_timeline=activity_timeline
        )
    
    # Helper methods
    async def _get_comment_with_relations(
        self,
        comment_id: UUID,
        include_replies: bool = True,
        current_user_id: Optional[UUID] = None
    ) -> Optional[CommentResponse]:
        """Get comment with all relationships loaded."""
        query = select(Comment).options(
            selectinload(Comment.author),
            selectinload(Comment.likes),
        ).where(Comment.id == comment_id)
        
        if include_replies:
            query = query.options(selectinload(Comment.replies))
        
        result = await self.db.execute(query)
        comment = result.scalar_one_or_none()
        
        if not comment:
            return None
        
        return await self._convert_to_response(comment, current_user_id=current_user_id)
    
    async def _convert_to_response(
        self, 
        comment: Comment, 
        current_user_id: Optional[UUID] = None
    ) -> CommentResponse:
        """Convert Comment model to CommentResponse."""
        # Parse mentioned users
        mentioned_users = []
        if comment.mentioned_users:
            try:
                mentioned_users = [UUID(uid) for uid in json.loads(comment.mentioned_users)]
            except (json.JSONDecodeError, ValueError):
                pass
        
        # Check if current user liked this comment
        user_liked = False
        if current_user_id and comment.likes:
            user_liked = any(like.user_id == current_user_id for like in comment.likes)
        
        # Convert likes
        likes = [
            {
                "id": like.id,
                "user_id": like.user_id,
                "reaction_type": like.reaction_type,
                "created_at": like.created_at
            }
            for like in comment.likes
        ] if comment.likes else []
        
        # Convert replies
        replies = []
        if hasattr(comment, 'replies') and comment.replies:
            for reply in comment.replies:
                reply_response = await self._convert_to_response(reply, current_user_id)
                replies.append(reply_response)
        
        return CommentResponse(
            id=comment.id,
            content=comment.content,
            content_type=comment.content_type,
            comment_type=comment.comment_type,
            status=comment.status,
            parent_id=comment.parent_id,
            thread_id=comment.thread_id,
            depth=comment.depth,
            board_id=comment.board_id,
            resource_id=comment.resource_id,
            frame_id=comment.frame_id,
            card_id=comment.card_id,
            position_x=comment.position_x,
            position_y=comment.position_y,
            mentioned_users=mentioned_users,
            is_pinned=comment.is_pinned,
            is_resolved=comment.is_resolved,
            is_private=comment.is_private,
            likes_count=comment.likes_count,
            replies_count=comment.replies_count,
            author_id=comment.author_id,
            resolved_by_id=comment.resolved_by_id,
            created_at=comment.created_at,
            updated_at=comment.updated_at,
            resolved_at=comment.resolved_at,
            edited_at=comment.edited_at,
            author={
                "id": comment.author.id,
                "username": comment.author.username,
                "full_name": comment.author.full_name,
                "avatar_url": comment.author.avatar_url
            },
            replies=replies if replies else None,
            likes=likes if likes else None,
            user_liked=user_liked
        )
    
    async def _get_thread_with_relations(
        self,
        thread_id: UUID,
        include_comments: bool = True
    ) -> Optional[CommentThreadResponse]:
        """Get thread with all relationships loaded."""
        query = select(CommentThread).options(
            selectinload(CommentThread.created_by)
        ).where(CommentThread.id == thread_id)
        
        result = await self.db.execute(query)
        thread = result.scalar_one_or_none()
        
        if not thread:
            return None
        
        return await self._convert_thread_to_response(thread, include_comments)
    
    async def _convert_thread_to_response(
        self,
        thread: CommentThread,
        include_comments: bool = True
    ) -> CommentThreadResponse:
        """Convert CommentThread model to CommentThreadResponse."""
        recent_comments = []
        if include_comments:
            # Get recent comments in this thread
            comments_result = await self.db.execute(
                select(Comment)
                .options(selectinload(Comment.author))
                .where(Comment.thread_id == thread.id)
                .where(Comment.status != CommentStatus.DELETED)
                .order_by(desc(Comment.created_at))
                .limit(5)
            )
            comments = comments_result.scalars().all()
            
            for comment in comments:
                comment_response = await self._convert_to_response(comment)
                recent_comments.append(comment_response)
        
        return CommentThreadResponse(
            id=thread.id,
            title=thread.title,
            description=thread.description,
            board_id=thread.board_id,
            resource_id=thread.resource_id,
            is_locked=thread.is_locked,
            is_resolved=thread.is_resolved,
            is_pinned=thread.is_pinned,
            comments_count=thread.comments_count,
            participants_count=thread.participants_count,
            created_by_id=thread.created_by_id,
            created_at=thread.created_at,
            updated_at=thread.updated_at,
            last_activity_at=thread.last_activity_at,
            created_by={
                "id": thread.created_by.id,
                "username": thread.created_by.username,
                "full_name": thread.created_by.full_name,
                "avatar_url": thread.created_by.avatar_url
            },
            recent_comments=recent_comments if recent_comments else None
        )