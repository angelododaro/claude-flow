"""
Usage tracking service for billing and limits.
"""

from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from fastapi import HTTPException, status
import json

from app.models.user import User
from app.models.subscription import (
    Subscription, UsageRecord, UsageType, 
    SubscriptionStatus, Plan
)
from app.core.config import settings


class UsageTracker:
    """Track and enforce usage limits."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def check_credits(self, user_id: str, credits_needed: int = 1) -> bool:
        """
        Check if user has enough credits.
        
        Args:
            user_id: User ID
            credits_needed: Credits required
            
        Returns:
            True if user has enough credits
        """
        # Get user's subscription
        result = await self.db.execute(
            select(Subscription)
            .where(
                Subscription.user_id == user_id,
                Subscription.status == SubscriptionStatus.ACTIVE
            )
        )
        subscription = result.scalar_one_or_none()
        
        if not subscription:
            return False
        
        # Calculate current period usage
        period_start = subscription.current_period_start or datetime.utcnow()
        period_end = subscription.current_period_end or datetime.utcnow()
        
        usage_result = await self.db.execute(
            select(func.sum(UsageRecord.credits_used))
            .where(
                UsageRecord.user_id == user_id,
                UsageRecord.timestamp >= period_start,
                UsageRecord.timestamp <= period_end
            )
        )
        current_usage = usage_result.scalar() or 0
        
        available_credits = subscription.current_credits - current_usage
        return available_credits >= credits_needed
    
    async def track_usage(
        self, 
        user_id: str, 
        usage_type: UsageType, 
        credits_used: int = 1,
        quantity: int = 1,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Track usage and deduct credits.
        
        Args:
            user_id: User ID
            usage_type: Type of usage
            credits_used: Credits to deduct
            quantity: Quantity of items processed
            metadata: Additional metadata
            
        Returns:
            True if usage was tracked successfully
            
        Raises:
            HTTPException: If insufficient credits
        """
        # Check if user has enough credits
        has_credits = await self.check_credits(user_id, credits_used)
        if not has_credits:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Insufficient credits. Please upgrade your plan."
            )
        
        # Get subscription
        result = await self.db.execute(
            select(Subscription)
            .where(
                Subscription.user_id == user_id,
                Subscription.status == SubscriptionStatus.ACTIVE
            )
        )
        subscription = result.scalar_one_or_none()
        
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active subscription found"
            )
        
        # Create usage record
        usage_record = UsageRecord(
            user_id=user_id,
            subscription_id=subscription.id,
            usage_type=usage_type,
            quantity=quantity,
            credits_used=credits_used,
            metadata=json.dumps(metadata) if metadata else None,
            timestamp=datetime.utcnow()
        )
        
        self.db.add(usage_record)
        await self.db.commit()
        
        return True
    
    async def get_usage_limits(self, user_id: str) -> Dict[str, Any]:
        """
        Get usage limits for user's plan.
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with usage limits
        """
        # Get user's subscription and plan
        result = await self.db.execute(
            select(Subscription, Plan)
            .join(Plan, Subscription.plan_id == Plan.id)
            .where(
                Subscription.user_id == user_id,
                Subscription.status == SubscriptionStatus.ACTIVE
            )
        )
        row = result.first()
        
        if not row:
            # Return free tier limits
            return {
                "ai_credits": settings.free_tier_credits,
                "storage_gb": 1,
                "max_team_members": 1,
                "max_boards": 10,
                "api_rate_limit": 100
            }
        
        subscription, plan = row
        
        return {
            "ai_credits": plan.ai_credits,
            "storage_gb": plan.storage_gb,
            "max_team_members": plan.max_team_members,
            "max_boards": plan.max_boards,
            "api_rate_limit": plan.api_rate_limit,
            "current_credits": subscription.current_credits,
            "features": json.loads(plan.features) if plan.features else {}
        }
    
    async def check_feature_access(self, user_id: str, feature: str) -> bool:
        """
        Check if user has access to a specific feature.
        
        Args:
            user_id: User ID
            feature: Feature name
            
        Returns:
            True if user has access
        """
        limits = await self.get_usage_limits(user_id)
        features = limits.get("features", {})
        return features.get(feature, False)
    
    async def add_credits(self, user_id: str, credits: int, reason: str = "manual") -> bool:
        """
        Add credits to user's account.
        
        Args:
            user_id: User ID
            credits: Credits to add
            reason: Reason for adding credits
            
        Returns:
            True if credits were added
        """
        # Get subscription
        result = await self.db.execute(
            select(Subscription)
            .where(
                Subscription.user_id == user_id,
                Subscription.status == SubscriptionStatus.ACTIVE
            )
        )
        subscription = result.scalar_one_or_none()
        
        if not subscription:
            return False
        
        # Add credits
        subscription.current_credits += credits
        subscription.total_credits_purchased += credits
        
        await self.db.commit()
        
        # Log the credit addition
        usage_record = UsageRecord(
            user_id=user_id,
            subscription_id=subscription.id,
            usage_type=UsageType.API_CALLS,  # Use as generic type
            quantity=1,
            credits_used=-credits,  # Negative for addition
            metadata=json.dumps({"reason": reason, "type": "credit_addition"}),
            timestamp=datetime.utcnow()
        )
        
        self.db.add(usage_record)
        await self.db.commit()
        
        return True
    
    async def get_current_usage(self, user_id: str) -> Dict[str, Any]:
        """
        Get current period usage for user.
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with usage statistics
        """
        # Get subscription
        result = await self.db.execute(
            select(Subscription)
            .where(
                Subscription.user_id == user_id,
                Subscription.status == SubscriptionStatus.ACTIVE
            )
        )
        subscription = result.scalar_one_or_none()
        
        if not subscription:
            return {
                "total_credits_used": 0,
                "credits_remaining": settings.free_tier_credits,
                "usage_by_type": {}
            }
        
        # Calculate current period usage
        period_start = subscription.current_period_start or datetime.utcnow()
        period_end = subscription.current_period_end or datetime.utcnow()
        
        # Total usage
        total_usage_result = await self.db.execute(
            select(func.sum(UsageRecord.credits_used))
            .where(
                UsageRecord.user_id == user_id,
                UsageRecord.timestamp >= period_start,
                UsageRecord.timestamp <= period_end,
                UsageRecord.credits_used > 0  # Exclude credit additions
            )
        )
        total_usage = total_usage_result.scalar() or 0
        
        # Usage by type
        usage_by_type_result = await self.db.execute(
            select(UsageRecord.usage_type, func.sum(UsageRecord.credits_used))
            .where(
                UsageRecord.user_id == user_id,
                UsageRecord.timestamp >= period_start,
                UsageRecord.timestamp <= period_end,
                UsageRecord.credits_used > 0
            )
            .group_by(UsageRecord.usage_type)
        )
        usage_by_type = dict(usage_by_type_result.all())
        
        credits_remaining = max(0, subscription.current_credits - total_usage)
        
        return {
            "total_credits_used": total_usage,
            "credits_remaining": credits_remaining,
            "usage_by_type": usage_by_type,
            "period_start": period_start,
            "period_end": period_end
        }


# Dependency for getting usage tracker
async def get_usage_tracker(db: AsyncSession) -> UsageTracker:
    """Get usage tracker instance."""
    return UsageTracker(db)


# Usage tracking decorators and middleware would go here
class UsageMiddleware:
    """Middleware to track API usage."""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        # Implementation for tracking API calls
        # Would track based on endpoint, user, etc.
        return await self.app(scope, receive, send)