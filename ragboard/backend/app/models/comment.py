"""
Comment model for board collaboration system.
"""

from typing import Optional, List
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, Boolean, Integer, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.db.base import Base


class CommentType(str, enum.Enum):
    """Comment type enumeration."""
    GENERAL = "general"
    ANNOTATION = "annotation"
    SUGGESTION = "suggestion"
    QUESTION = "question"
    APPROVAL = "approval"


class CommentStatus(str, enum.Enum):
    """Comment status enumeration."""
    ACTIVE = "active"
    RESOLVED = "resolved"
    DELETED = "deleted"
    HIDDEN = "hidden"


class Comment(Base):
    """Comment model for board collaboration."""
    
    __tablename__ = "comment"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4,
        index=True
    )
    
    # Content
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(20), default="markdown")
    
    # Comment metadata
    comment_type: Mapped[CommentType] = mapped_column(
        SQLEnum(CommentType), 
        default=CommentType.GENERAL
    )
    status: Mapped[CommentStatus] = mapped_column(
        SQLEnum(CommentStatus), 
        default=CommentStatus.ACTIVE
    )
    
    # Threading
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("comment.id"),
        nullable=True,
        index=True
    )
    thread_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True
    )
    depth: Mapped[int] = mapped_column(Integer, default=0)
    
    # Context - what the comment is attached to
    board_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    resource_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resource.id"),
        nullable=True,
        index=True
    )
    frame_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    card_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Position for visual comments/annotations
    position_x: Mapped[Optional[float]] = mapped_column(nullable=True)
    position_y: Mapped[Optional[float]] = mapped_column(nullable=True)
    
    # Mentions - stored as JSON array of user IDs
    mentioned_users: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Flags
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Engagement
    likes_count: Mapped[int] = mapped_column(Integer, default=0)
    replies_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Foreign keys
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id"),
        nullable=False,
        index=True
    )
    resolved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id"),
        nullable=True
    )
    
    # Timestamps
    resolved_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    edited_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    
    # Relationships
    author: Mapped["User"] = relationship(
        "User", 
        foreign_keys=[author_id],
        back_populates="comments"
    )
    resolved_by: Mapped[Optional["User"]] = relationship(
        "User", 
        foreign_keys=[resolved_by_id]
    )
    resource: Mapped[Optional["Resource"]] = relationship(
        "Resource",
        back_populates="comments"
    )
    
    # Self-referential relationship for threading
    parent: Mapped[Optional["Comment"]] = relationship(
        "Comment",
        remote_side=[id],
        back_populates="replies"
    )
    replies: Mapped[List["Comment"]] = relationship(
        "Comment",
        back_populates="parent",
        cascade="all, delete-orphan"
    )
    
    # Comment likes
    likes: Mapped[List["CommentLike"]] = relationship(
        "CommentLike",
        back_populates="comment",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<Comment {self.id} by {self.author_id}>"


class CommentLike(Base):
    """Comment like/reaction model."""
    
    __tablename__ = "comment_like"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    
    # Foreign keys
    comment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("comment.id"),
        nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id"),
        nullable=False
    )
    
    # Reaction type (like, love, thumbs_up, etc.)
    reaction_type: Mapped[str] = mapped_column(String(20), default="like")
    
    # Relationships
    comment: Mapped["Comment"] = relationship(
        "Comment",
        back_populates="likes"
    )
    user: Mapped["User"] = relationship("User")
    
    def __repr__(self) -> str:
        return f"<CommentLike {self.user_id} -> {self.comment_id}>"


class CommentThread(Base):
    """Comment thread model for organizing discussions."""
    
    __tablename__ = "comment_thread"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    
    # Thread metadata
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Context
    board_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    resource_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resource.id"),
        nullable=True
    )
    
    # Thread state
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Metrics
    comments_count: Mapped[int] = mapped_column(Integer, default=0)
    participants_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Foreign keys
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id"),
        nullable=False
    )
    
    # Timestamps
    last_activity_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    
    # Relationships
    created_by: Mapped["User"] = relationship("User")
    resource: Mapped[Optional["Resource"]] = relationship("Resource")
    
    def __repr__(self) -> str:
        return f"<CommentThread {self.id}: {self.title}>"