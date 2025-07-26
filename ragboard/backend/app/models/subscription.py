"""
Subscription and billing models.
"""

from typing import Optional, List
from datetime import datetime
from enum import Enum
from sqlalchemy import String, Boolean, Text, ForeignKey, Integer, Numeric, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base import Base


class PlanType(str, Enum):
    """Subscription plan types."""
    FREE = "free"
    BASIC = "basic"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class SubscriptionStatus(str, Enum):
    """Subscription status."""
    ACTIVE = "active"
    CANCELED = "canceled"
    PAST_DUE = "past_due"
    UNPAID = "unpaid"
    TRIALING = "trialing"


class UsageType(str, Enum):
    """Usage tracking types."""
    AI_CHAT = "ai_chat"
    DOCUMENT_PROCESSING = "document_processing"
    VECTOR_SEARCH = "vector_search"
    API_CALLS = "api_calls"
    STORAGE = "storage"


class Plan(Base):
    """Subscription plan model."""
    
    __tablename__ = "plan"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), unique=True)
    type: Mapped[PlanType] = mapped_column(String(20))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Pricing
    price_monthly: Mapped[int] = mapped_column(Integer, default=0)  # in cents
    price_yearly: Mapped[int] = mapped_column(Integer, default=0)  # in cents
    stripe_price_id_monthly: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    stripe_price_id_yearly: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Limits
    ai_credits: Mapped[int] = mapped_column(Integer, default=0)
    storage_gb: Mapped[int] = mapped_column(Integer, default=1)
    max_team_members: Mapped[int] = mapped_column(Integer, default=1)
    max_boards: Mapped[int] = mapped_column(Integer, default=10)
    api_rate_limit: Mapped[int] = mapped_column(Integer, default=100)  # per hour
    
    # Features
    features: Mapped[Optional[dict]] = mapped_column(Text, nullable=True)  # JSON
    
    # Metadata
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    
    # Relationships
    subscriptions: Mapped[List["Subscription"]] = relationship(
        "Subscription",
        back_populates="plan"
    )
    
    def __repr__(self) -> str:
        return f"<Plan {self.name}>"


class Subscription(Base):
    """User subscription model."""
    
    __tablename__ = "subscription"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    
    # Stripe data
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    stripe_price_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Subscription details
    status: Mapped[SubscriptionStatus] = mapped_column(String(20), default=SubscriptionStatus.ACTIVE)
    is_yearly: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Dates
    trial_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    trial_end: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    current_period_start: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    current_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    canceled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Credits and usage
    current_credits: Mapped[int] = mapped_column(Integer, default=0)
    total_credits_purchased: Mapped[int] = mapped_column(Integer, default=0)
    
    # Foreign keys
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id"),
        nullable=False
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("plan.id"),
        nullable=False
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="subscription")
    plan: Mapped["Plan"] = relationship("Plan", back_populates="subscriptions")
    usage_records: Mapped[List["UsageRecord"]] = relationship(
        "UsageRecord",
        back_populates="subscription",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<Subscription {self.user_id} - {self.plan.name}>"


class UsageRecord(Base):
    """Track user usage for billing and limits."""
    
    __tablename__ = "usage_record"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    
    # Usage details
    usage_type: Mapped[UsageType] = mapped_column(String(50))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    credits_used: Mapped[int] = mapped_column(Integer, default=1)
    
    # Metadata
    metadata: Mapped[Optional[dict]] = mapped_column(Text, nullable=True)  # JSON
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Foreign keys
    subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subscription.id"),
        nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id"),
        nullable=False
    )
    
    # Relationships
    subscription: Mapped["Subscription"] = relationship("Subscription", back_populates="usage_records")
    user: Mapped["User"] = relationship("User")
    
    def __repr__(self) -> str:
        return f"<UsageRecord {self.usage_type} - {self.credits_used} credits>"


class Team(Base):
    """Team/Organization model."""
    
    __tablename__ = "team"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Settings
    settings: Mapped[Optional[dict]] = mapped_column(Text, nullable=True)  # JSON
    
    # Billing
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Foreign keys
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id"),
        nullable=False
    )
    
    # Relationships
    owner: Mapped["User"] = relationship("User", foreign_keys=[owner_id])
    members: Mapped[List["TeamMember"]] = relationship(
        "TeamMember",
        back_populates="team",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<Team {self.name}>"


class TeamRole(str, Enum):
    """Team member roles."""
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


class TeamMember(Base):
    """Team membership model."""
    
    __tablename__ = "team_member"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    
    role: Mapped[TeamRole] = mapped_column(String(20), default=TeamRole.MEMBER)
    invited_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    joined_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Foreign keys
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("team.id"),
        nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id"),
        nullable=False
    )
    
    # Relationships
    team: Mapped["Team"] = relationship("Team", back_populates="members")
    user: Mapped["User"] = relationship("User")
    
    def __repr__(self) -> str:
        return f"<TeamMember {self.user_id} in {self.team_id}>"


class ReferralCode(Base):
    """Referral code model."""
    
    __tablename__ = "referral_code"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Usage tracking
    uses_count: Mapped[int] = mapped_column(Integer, default=0)
    max_uses: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Rewards
    referrer_credits: Mapped[int] = mapped_column(Integer, default=50)
    referee_credits: Mapped[int] = mapped_column(Integer, default=100)
    
    # Dates
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Foreign keys
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id"),
        nullable=False
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User")
    referrals: Mapped[List["Referral"]] = relationship(
        "Referral",
        back_populates="referral_code",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<ReferralCode {self.code}>"


class Referral(Base):
    """Referral tracking model."""
    
    __tablename__ = "referral"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    
    # Reward tracking
    referrer_credits_awarded: Mapped[int] = mapped_column(Integer, default=0)
    referee_credits_awarded: Mapped[int] = mapped_column(Integer, default=0)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Dates
    referred_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Foreign keys
    referral_code_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("referral_code.id"),
        nullable=False
    )
    referrer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id"),
        nullable=False
    )
    referee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user.id"),
        nullable=False
    )
    
    # Relationships
    referral_code: Mapped["ReferralCode"] = relationship("ReferralCode", back_populates="referrals")
    referrer: Mapped["User"] = relationship("User", foreign_keys=[referrer_id])
    referee: Mapped["User"] = relationship("User", foreign_keys=[referee_id])
    
    def __repr__(self) -> str:
        return f"<Referral {self.referrer_id} -> {self.referee_id}>"