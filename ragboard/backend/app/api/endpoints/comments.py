"""
Comment management endpoints.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.api.dependencies.auth import get_current_user
from app.db.base import get_async_session
from app.models.user import User
from app.models.comment import Comment, CommentLike, CommentThread, CommentStatus
from app.schemas.comment import (
    CommentCreate,
    CommentUpdate,
    CommentResponse,
    CommentListResponse,
    CommentThreadCreate,
    CommentThreadUpdate,
    CommentThreadResponse,
    CommentLikeCreate,
    CommentSearchRequest,
    CommentStatsResponse
)
from app.services.comment import CommentService
from app.services.notification import NotificationService

router = APIRouter(prefix="/comments", tags=["comments"])


@router.post("/", response_model=CommentResponse)
async def create_comment(
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Create a new comment."""
    service = CommentService(db)
    comment = await service.create_comment(
        author_id=current_user.id,
        comment_data=comment_data
    )
    
    # Send notifications for mentions
    if comment_data.mentioned_users:
        notification_service = NotificationService(db)
        await notification_service.notify_mention(
            comment=comment,
            mentioned_users=comment_data.mentioned_users,
            sender=current_user
        )
    
    return comment


@router.get("/", response_model=CommentListResponse)
async def list_comments(
    board_id: Optional[str] = Query(None),
    resource_id: Optional[UUID] = Query(None),
    parent_id: Optional[UUID] = Query(None),
    thread_id: Optional[UUID] = Query(None),
    author_id: Optional[UUID] = Query(None),
    comment_type: Optional[str] = Query(None),
    is_resolved: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """List comments with filtering options."""
    service = CommentService(db)
    return await service.list_comments(
        board_id=board_id,
        resource_id=resource_id,
        parent_id=parent_id,
        thread_id=thread_id,
        author_id=author_id,
        comment_type=comment_type,
        is_resolved=is_resolved,
        skip=skip,
        limit=limit,
        current_user_id=current_user.id
    )


@router.get("/{comment_id}", response_model=CommentResponse)
async def get_comment(
    comment_id: UUID,
    include_replies: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get a specific comment by ID."""
    service = CommentService(db)
    comment = await service.get_comment(
        comment_id=comment_id,
        include_replies=include_replies,
        current_user_id=current_user.id
    )
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    return comment


@router.put("/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: UUID,
    comment_data: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Update a comment."""
    service = CommentService(db)
    comment = await service.update_comment(
        comment_id=comment_id,
        comment_data=comment_data,
        current_user_id=current_user.id
    )
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found or access denied"
        )
    return comment


@router.delete("/{comment_id}")
async def delete_comment(
    comment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete a comment."""
    service = CommentService(db)
    success = await service.delete_comment(
        comment_id=comment_id,
        current_user_id=current_user.id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found or access denied"
        )
    return {"message": "Comment deleted successfully"}


@router.post("/{comment_id}/like")
async def like_comment(
    comment_id: UUID,
    like_data: CommentLikeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Like or react to a comment."""
    service = CommentService(db)
    result = await service.toggle_like(
        comment_id=comment_id,
        user_id=current_user.id,
        reaction_type=like_data.reaction_type
    )
    return result


@router.delete("/{comment_id}/like")
async def unlike_comment(
    comment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Remove like from a comment."""
    service = CommentService(db)
    success = await service.unlike_comment(
        comment_id=comment_id,
        user_id=current_user.id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Like not found"
        )
    return {"message": "Like removed successfully"}


@router.post("/{comment_id}/resolve")
async def resolve_comment(
    comment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Mark a comment as resolved."""
    service = CommentService(db)
    comment = await service.resolve_comment(
        comment_id=comment_id,
        resolved_by_id=current_user.id
    )
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    return {"message": "Comment resolved successfully"}


@router.post("/{comment_id}/unresolve")
async def unresolve_comment(
    comment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Mark a comment as unresolved."""
    service = CommentService(db)
    comment = await service.unresolve_comment(
        comment_id=comment_id
    )
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found"
        )
    return {"message": "Comment marked as unresolved"}


# Comment Thread endpoints
@router.post("/threads", response_model=CommentThreadResponse)
async def create_thread(
    thread_data: CommentThreadCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Create a new comment thread."""
    service = CommentService(db)
    thread = await service.create_thread(
        created_by_id=current_user.id,
        thread_data=thread_data
    )
    return thread


@router.get("/threads", response_model=List[CommentThreadResponse])
async def list_threads(
    board_id: Optional[str] = Query(None),
    resource_id: Optional[UUID] = Query(None),
    is_resolved: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """List comment threads."""
    service = CommentService(db)
    return await service.list_threads(
        board_id=board_id,
        resource_id=resource_id,
        is_resolved=is_resolved,
        skip=skip,
        limit=limit
    )


@router.get("/threads/{thread_id}", response_model=CommentThreadResponse)
async def get_thread(
    thread_id: UUID,
    include_comments: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get a specific thread by ID."""
    service = CommentService(db)
    thread = await service.get_thread(
        thread_id=thread_id,
        include_comments=include_comments
    )
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found"
        )
    return thread


@router.put("/threads/{thread_id}", response_model=CommentThreadResponse)
async def update_thread(
    thread_id: UUID,
    thread_data: CommentThreadUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Update a comment thread."""
    service = CommentService(db)
    thread = await service.update_thread(
        thread_id=thread_id,
        thread_data=thread_data,
        current_user_id=current_user.id
    )
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found or access denied"
        )
    return thread


@router.delete("/threads/{thread_id}")
async def delete_thread(
    thread_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Delete a comment thread."""
    service = CommentService(db)
    success = await service.delete_thread(
        thread_id=thread_id,
        current_user_id=current_user.id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thread not found or access denied"
        )
    return {"message": "Thread deleted successfully"}


@router.post("/search", response_model=CommentListResponse)
async def search_comments(
    search_request: CommentSearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Search comments with advanced filters."""
    service = CommentService(db)
    return await service.search_comments(
        search_request=search_request,
        current_user_id=current_user.id
    )


@router.get("/stats/overview", response_model=CommentStatsResponse)
async def get_comment_stats(
    board_id: Optional[str] = Query(None),
    resource_id: Optional[UUID] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
):
    """Get comment statistics and analytics."""
    service = CommentService(db)
    return await service.get_comment_stats(
        board_id=board_id,
        resource_id=resource_id,
        date_from=date_from,
        date_to=date_to
    )