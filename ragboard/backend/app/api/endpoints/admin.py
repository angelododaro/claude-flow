"""
Admin dashboard endpoints.
"""

from typing import Optional, List, Annotated, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, desc, and_, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, EmailStr
from enum import Enum

from app.core.config import settings
from app.db.base import get_async_session
from app.models.user import User, Role
from app.models.subscription import (
    Plan, Subscription, UsageRecord, PlanType, 
    SubscriptionStatus, UsageType, Team, TeamMember
)
from app.models.board import Board
from app.models.resource import Resource
import json
from app.api.dependencies.auth import get_current_superuser


router = APIRouter(prefix="/admin", tags=["admin"])


class AdminUserResponse(BaseModel):
    """Admin user response with extended info."""
    id: str
    email: str
    username: str
    full_name: Optional[str]
    is_active: bool
    is_verified: bool
    is_superuser: bool
    created_at: datetime
    last_login: Optional[datetime]
    avatar_url: Optional[str]
    subscription_plan: Optional[str]
    subscription_status: Optional[str]
    total_credits_used: int
    boards_count: int
    resources_count: int
    
    class Config:
        from_attributes = True


class AdminStatsResponse(BaseModel):
    """Admin dashboard statistics."""
    total_users: int
    active_users_24h: int
    active_users_7d: int
    active_users_30d: int
    total_subscriptions: int
    subscription_breakdown: Dict[str, int]
    total_revenue_monthly: float
    total_revenue_yearly: float
    total_boards: int
    total_resources: int
    total_credits_used: int
    average_credits_per_user: float
    top_usage_types: List[Dict[str, Any]]
    growth_metrics: Dict[str, float]


class CreatePlanRequest(BaseModel):
    """Create plan request."""
    name: str
    type: PlanType
    description: Optional[str] = None
    price_monthly: int
    price_yearly: int
    ai_credits: int
    storage_gb: int = 1
    max_team_members: int = 1
    max_boards: int = 10
    api_rate_limit: int = 100
    features: Optional[Dict[str, Any]] = None
    stripe_price_id_monthly: Optional[str] = None
    stripe_price_id_yearly: Optional[str] = None


class UpdateUserRequest(BaseModel):
    """Update user request."""
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    is_superuser: Optional[bool] = None
    subscription_plan_id: Optional[str] = None
    credits_to_add: Optional[int] = None


class BulkActionRequest(BaseModel):
    """Bulk action request."""
    user_ids: List[str]
    action: str  # "activate", "deactivate", "verify", "add_credits"
    value: Optional[Any] = None  # Additional data for the action


@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get admin dashboard statistics.
    """
    now = datetime.utcnow()
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    # User statistics
    total_users_result = await db.execute(select(func.count(User.id)))
    total_users = total_users_result.scalar()
    
    active_24h_result = await db.execute(
        select(func.count(User.id))
        .where(User.last_login >= day_ago)
    )
    active_users_24h = active_24h_result.scalar() or 0
    
    active_7d_result = await db.execute(
        select(func.count(User.id))
        .where(User.last_login >= week_ago)
    )
    active_users_7d = active_7d_result.scalar() or 0
    
    active_30d_result = await db.execute(
        select(func.count(User.id))
        .where(User.last_login >= month_ago)
    )
    active_users_30d = active_30d_result.scalar() or 0
    
    # Subscription statistics
    total_subscriptions_result = await db.execute(
        select(func.count(Subscription.id))
        .where(Subscription.status == SubscriptionStatus.ACTIVE)
    )
    total_subscriptions = total_subscriptions_result.scalar() or 0
    
    # Subscription breakdown by plan type
    subscription_breakdown_result = await db.execute(
        select(Plan.type, func.count(Subscription.id))
        .join(Subscription, Plan.id == Subscription.plan_id)
        .where(Subscription.status == SubscriptionStatus.ACTIVE)
        .group_by(Plan.type)
    )
    subscription_breakdown = dict(subscription_breakdown_result.all())
    
    # Revenue calculations (mock for now - would integrate with Stripe)
    revenue_result = await db.execute(
        select(Plan.price_monthly, Plan.price_yearly, func.count(Subscription.id))
        .join(Subscription, Plan.id == Subscription.plan_id)
        .where(Subscription.status == SubscriptionStatus.ACTIVE)
        .group_by(Plan.price_monthly, Plan.price_yearly)
    )
    
    total_revenue_monthly = 0
    total_revenue_yearly = 0
    for monthly, yearly, count in revenue_result.all():
        total_revenue_monthly += (monthly / 100) * count  # Convert cents to dollars
        total_revenue_yearly += (yearly / 100) * count
    
    # Content statistics
    total_boards_result = await db.execute(select(func.count(Board.id)))
    total_boards = total_boards_result.scalar() or 0
    
    total_resources_result = await db.execute(select(func.count(Resource.id)))
    total_resources = total_resources_result.scalar() or 0
    
    # Usage statistics
    total_credits_result = await db.execute(
        select(func.sum(UsageRecord.credits_used))
    )
    total_credits_used = total_credits_result.scalar() or 0
    
    average_credits = total_credits_used / max(total_users, 1)
    
    # Top usage types
    top_usage_result = await db.execute(
        select(UsageRecord.usage_type, func.sum(UsageRecord.credits_used))
        .group_by(UsageRecord.usage_type)
        .order_by(desc(func.sum(UsageRecord.credits_used)))
        .limit(5)
    )
    top_usage_types = [
        {"type": usage_type, "credits": credits}
        for usage_type, credits in top_usage_result.all()
    ]
    
    # Growth metrics (compare to previous month)
    prev_month = now - timedelta(days=60)
    
    prev_users_result = await db.execute(
        select(func.count(User.id))
        .where(User.created_at <= month_ago)
    )
    prev_users = prev_users_result.scalar() or 0
    
    user_growth = ((total_users - prev_users) / max(prev_users, 1)) * 100
    
    growth_metrics = {
        "user_growth_30d": round(user_growth, 2),
        "revenue_growth_30d": 0.0,  # Would calculate from Stripe data
        "usage_growth_30d": 0.0     # Would calculate from usage data
    }
    
    return AdminStatsResponse(
        total_users=total_users,
        active_users_24h=active_users_24h,
        active_users_7d=active_users_7d,
        active_users_30d=active_users_30d,
        total_subscriptions=total_subscriptions,
        subscription_breakdown=subscription_breakdown,
        total_revenue_monthly=total_revenue_monthly,
        total_revenue_yearly=total_revenue_yearly,
        total_boards=total_boards,
        total_resources=total_resources,
        total_credits_used=total_credits_used,
        average_credits_per_user=round(average_credits, 2),
        top_usage_types=top_usage_types,
        growth_metrics=growth_metrics
    )


@router.get("/users", response_model=List[AdminUserResponse])
async def get_users(
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: AsyncSession = Depends(get_async_session),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    is_verified: Optional[bool] = Query(None),
    subscription_status: Optional[str] = Query(None)
):
    """
    Get users with filtering and pagination.
    """
    query = select(User).options(
        selectinload(User.subscription).selectinload(Subscription.plan)
    )
    
    # Apply filters
    filters = []
    if search:
        search_pattern = f"%{search}%"
        filters.append(
            or_(
                User.email.ilike(search_pattern),
                User.username.ilike(search_pattern),
                User.full_name.ilike(search_pattern)
            )
        )
    
    if is_active is not None:
        filters.append(User.is_active == is_active)
    
    if is_verified is not None:
        filters.append(User.is_verified == is_verified)
    
    if subscription_status:
        filters.append(Subscription.status == subscription_status)
        query = query.join(Subscription, User.id == Subscription.user_id)
    
    if filters:
        query = query.where(and_(*filters))
    
    # Apply pagination
    query = query.offset(skip).limit(limit).order_by(desc(User.created_at))
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    # Build response with additional data
    user_responses = []
    for user in users:
        # Get usage stats
        usage_result = await db.execute(
            select(func.sum(UsageRecord.credits_used))
            .where(UsageRecord.user_id == user.id)
        )
        total_credits_used = usage_result.scalar() or 0
        
        # Get content counts
        boards_result = await db.execute(
            select(func.count(Board.id))
            .where(Board.user_id == user.id)
        )
        boards_count = boards_result.scalar() or 0
        
        resources_result = await db.execute(
            select(func.count(Resource.id))
            .where(Resource.owner_id == user.id)
        )
        resources_count = resources_result.scalar() or 0
        
        user_responses.append(AdminUserResponse(
            id=str(user.id),
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            is_active=user.is_active,
            is_verified=user.is_verified,
            is_superuser=user.is_superuser,
            created_at=user.created_at,
            last_login=user.last_login,
            avatar_url=user.avatar_url,
            subscription_plan=user.subscription.plan.name if user.subscription else None,
            subscription_status=user.subscription.status if user.subscription else None,
            total_credits_used=total_credits_used,
            boards_count=boards_count,
            resources_count=resources_count
        ))
    
    return user_responses


@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    request: UpdateUserRequest,
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: AsyncSession = Depends(get_async_session)
):
    """
    Update user details.
    """
    # Get user
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update fields
    if request.is_active is not None:
        user.is_active = request.is_active
    
    if request.is_verified is not None:
        user.is_verified = request.is_verified
    
    if request.is_superuser is not None:
        user.is_superuser = request.is_superuser
    
    # Update subscription plan
    if request.subscription_plan_id:
        subscription_result = await db.execute(
            select(Subscription).where(Subscription.user_id == user.id)
        )
        subscription = subscription_result.scalar_one_or_none()
        
        if subscription:
            subscription.plan_id = request.subscription_plan_id
    
    # Add credits
    if request.credits_to_add:
        subscription_result = await db.execute(
            select(Subscription).where(Subscription.user_id == user.id)
        )
        subscription = subscription_result.scalar_one_or_none()
        
        if subscription:
            subscription.current_credits += request.credits_to_add
    
    await db.commit()
    
    return {"message": "User updated successfully"}


@router.post("/users/bulk-action")
async def bulk_user_action(
    request: BulkActionRequest,
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: AsyncSession = Depends(get_async_session)
):
    """
    Perform bulk actions on users.
    """
    if not request.user_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No users selected"
        )
    
    # Get users
    result = await db.execute(
        select(User).where(User.id.in_(request.user_ids))
    )
    users = result.scalars().all()
    
    if len(users) != len(request.user_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Some users not found"
        )
    
    # Perform action
    if request.action == "activate":
        for user in users:
            user.is_active = True
    elif request.action == "deactivate":
        for user in users:
            user.is_active = False
    elif request.action == "verify":
        for user in users:
            user.is_verified = True
    elif request.action == "add_credits":
        if not request.value or not isinstance(request.value, int):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Credits amount required"
            )
        
        for user in users:
            subscription_result = await db.execute(
                select(Subscription).where(Subscription.user_id == user.id)
            )
            subscription = subscription_result.scalar_one_or_none()
            
            if subscription:
                subscription.current_credits += request.value
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid action"
        )
    
    await db.commit()
    
    return {
        "message": f"Bulk action '{request.action}' applied to {len(users)} users"
    }


@router.get("/plans", response_model=List[Dict[str, Any]])
async def get_admin_plans(
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get all plans for admin management.
    """
    result = await db.execute(
        select(Plan).order_by(Plan.sort_order, Plan.price_monthly)
    )
    plans = result.scalars().all()
    
    plan_data = []
    for plan in plans:
        # Get subscription count
        sub_count_result = await db.execute(
            select(func.count(Subscription.id))
            .where(
                Subscription.plan_id == plan.id,
                Subscription.status == SubscriptionStatus.ACTIVE
            )
        )
        subscription_count = sub_count_result.scalar() or 0
        
        plan_data.append({
            "id": str(plan.id),
            "name": plan.name,
            "type": plan.type,
            "description": plan.description,
            "price_monthly": plan.price_monthly,
            "price_yearly": plan.price_yearly,
            "ai_credits": plan.ai_credits,
            "storage_gb": plan.storage_gb,
            "max_team_members": plan.max_team_members,
            "max_boards": plan.max_boards,
            "api_rate_limit": plan.api_rate_limit,
            "features": json.loads(plan.features) if plan.features else {},
            "is_active": plan.is_active,
            "subscription_count": subscription_count,
            "created_at": plan.created_at
        })
    
    return plan_data


@router.post("/plans", response_model=Dict[str, Any])
async def create_plan(
    request: CreatePlanRequest,
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: AsyncSession = Depends(get_async_session)
):
    """
    Create a new subscription plan.
    """
    # Check if plan name exists
    result = await db.execute(
        select(Plan).where(Plan.name == request.name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plan name already exists"
        )
    
    # Create plan
    plan = Plan(
        name=request.name,
        type=request.type,
        description=request.description,
        price_monthly=request.price_monthly,
        price_yearly=request.price_yearly,
        ai_credits=request.ai_credits,
        storage_gb=request.storage_gb,
        max_team_members=request.max_team_members,
        max_boards=request.max_boards,
        api_rate_limit=request.api_rate_limit,
        features=json.dumps(request.features) if request.features else None,
        stripe_price_id_monthly=request.stripe_price_id_monthly,
        stripe_price_id_yearly=request.stripe_price_id_yearly,
        is_active=True
    )
    
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    
    return {
        "id": str(plan.id),
        "name": plan.name,
        "message": "Plan created successfully"
    }


@router.delete("/plans/{plan_id}")
async def delete_plan(
    plan_id: str,
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: AsyncSession = Depends(get_async_session)
):
    """
    Delete a subscription plan.
    """
    # Get plan
    result = await db.execute(
        select(Plan).where(Plan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found"
        )
    
    # Check if plan has active subscriptions
    sub_result = await db.execute(
        select(func.count(Subscription.id))
        .where(
            Subscription.plan_id == plan.id,
            Subscription.status == SubscriptionStatus.ACTIVE
        )
    )
    active_subscriptions = sub_result.scalar() or 0
    
    if active_subscriptions > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete plan with {active_subscriptions} active subscriptions"
        )
    
    # Soft delete
    plan.is_active = False
    await db.commit()
    
    return {"message": "Plan deleted successfully"}