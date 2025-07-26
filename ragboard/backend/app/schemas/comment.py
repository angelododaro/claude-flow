"""
Comment schemas for API requests and responses.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict

from app.models.comment import CommentType, CommentStatus


class CommentBase(BaseModel):
    """Base comment schema."""
    content: str = Field(..., min_length=1, max_length=5000)
    content_type: str = Field(default="markdown")
    comment_type: CommentType = Field(default=CommentType.GENERAL)
    board_id: Optional[str] = None
    resource_id: Optional[UUID] = None
    frame_id: Optional[str] = None
    card_id: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    is_private: bool = Field(default=False)


class CommentCreate(CommentBase):
    """Schema for creating a comment."""
    parent_id: Optional[UUID] = None
    mentioned_users: Optional[List[UUID]] = Field(default_factory=list)


class CommentUpdate(BaseModel):
    """Schema for updating a comment."""
    content: Optional[str] = Field(None, min_length=1, max_length=5000)
    comment_type: Optional[CommentType] = None
    is_resolved: Optional[bool] = None
    is_pinned: Optional[bool] = None
    is_private: Optional[bool] = None


class CommentAuthor(BaseModel):
    """Schema for comment author information."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    username: str
    full_name: Optional[str]
    avatar_url: Optional[str]


class CommentLikeResponse(BaseModel):
    """Schema for comment like response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    user_id: UUID
    reaction_type: str
    created_at: datetime


class CommentResponse(BaseModel):
    """Schema for comment response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    content: str
    content_type: str
    comment_type: CommentType
    status: CommentStatus
    parent_id: Optional[UUID]
    thread_id: Optional[UUID]
    depth: int
    board_id: Optional[str]
    resource_id: Optional[UUID]
    frame_id: Optional[str]
    card_id: Optional[str]
    position_x: Optional[float]
    position_y: Optional[float]
    mentioned_users: Optional[List[UUID]]
    is_pinned: bool
    is_resolved: bool
    is_private: bool
    likes_count: int
    replies_count: int
    author_id: UUID
    resolved_by_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]
    edited_at: Optional[datetime]
    
    # Included relationships
    author: CommentAuthor
    replies: Optional[List["CommentResponse"]] = None
    likes: Optional[List[CommentLikeResponse]] = None
    user_liked: Optional[bool] = None  # Whether current user liked this comment


class CommentListResponse(BaseModel):
    """Schema for paginated comment list."""
    comments: List[CommentResponse]
    total: int
    skip: int
    limit: int
    has_more: bool


class CommentThreadBase(BaseModel):
    """Base comment thread schema."""
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    board_id: Optional[str] = None
    resource_id: Optional[UUID] = None


class CommentThreadCreate(CommentThreadBase):
    """Schema for creating a comment thread."""
    pass


class CommentThreadUpdate(BaseModel):
    """Schema for updating a comment thread."""
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    is_locked: Optional[bool] = None
    is_resolved: Optional[bool] = None
    is_pinned: Optional[bool] = None


class CommentThreadResponse(BaseModel):
    """Schema for comment thread response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    title: Optional[str]
    description: Optional[str]
    board_id: Optional[str]
    resource_id: Optional[UUID]
    is_locked: bool
    is_resolved: bool
    is_pinned: bool
    comments_count: int
    participants_count: int
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime
    last_activity_at: Optional[datetime]
    
    # Included relationships
    created_by: CommentAuthor
    recent_comments: Optional[List[CommentResponse]] = None


class CommentLikeCreate(BaseModel):
    """Schema for creating a comment like."""
    reaction_type: str = Field(default="like")


class CommentMentionCreate(BaseModel):
    """Schema for mentioning users in comments."""
    comment_id: UUID
    mentioned_users: List[UUID]


class CommentSearchRequest(BaseModel):
    """Schema for comment search request."""
    query: Optional[str] = None
    board_id: Optional[str] = None
    resource_id: Optional[UUID] = None
    comment_type: Optional[CommentType] = None
    author_id: Optional[UUID] = None
    is_resolved: Optional[bool] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    limit: int = Field(default=20, ge=1, le=100)
    skip: int = Field(default=0, ge=0)


class CommentStatsResponse(BaseModel):
    """Schema for comment statistics."""
    total_comments: int
    resolved_comments: int
    pending_comments: int
    comments_by_type: Dict[str, int]
    top_contributors: List[Dict[str, Any]]
    activity_timeline: List[Dict[str, Any]]