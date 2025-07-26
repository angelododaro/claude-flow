"""
Subscription and billing endpoints.
"""

from typing import Optional, List, Annotated
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
import stripe
import json
from enum import Enum

from app.core.config import settings
from app.db.base import get_async_session
from app.models.user import User
from app.models.subscription import (
    Plan, Subscription, UsageRecord, PlanType, 
    SubscriptionStatus, UsageType, ReferralCode, Referral
)
from app.api.dependencies.auth import get_current_active_user
import shortuuid


# Configure Stripe
if settings.stripe_secret_key:
    stripe.api_key = settings.stripe_secret_key

router = APIRouter(prefix="/subscription", tags=["subscription"])


class PlanResponse(BaseModel):
    """Plan response model."""
    id: str
    name: str
    type: PlanType
    description: Optional[str]
    price_monthly: int
    price_yearly: int
    ai_credits: int
    storage_gb: int
    max_team_members: int
    max_boards: int
    features: Optional[dict]
    is_popular: bool = False
    
    class Config:
        from_attributes = True


class SubscriptionResponse(BaseModel):
    """Subscription response model."""
    id: str
    status: SubscriptionStatus
    is_yearly: bool
    current_credits: int
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]
    trial_end: Optional[datetime]
    plan: PlanResponse
    
    class Config:
        from_attributes = True


class UsageStatsResponse(BaseModel):
    """Usage statistics response."""
    current_period_usage: dict
    total_credits_used: int
    credits_remaining: int
    daily_usage: List[dict]
    usage_by_type: dict


class CreateSubscriptionRequest(BaseModel):
    """Create subscription request."""
    plan_id: str
    payment_method_id: str
    is_yearly: bool = False
    coupon_code: Optional[str] = None


class UpdateSubscriptionRequest(BaseModel):
    """Update subscription request."""
    plan_id: Optional[str] = None
    is_yearly: Optional[bool] = None


class CreateReferralCodeRequest(BaseModel):
    """Create referral code request."""
    custom_code: Optional[str] = None
    max_uses: Optional[int] = None
    expires_in_days: Optional[int] = None


class ReferralCodeResponse(BaseModel):
    """Referral code response."""
    id: str
    code: str
    uses_count: int
    max_uses: Optional[int]
    referrer_credits: int
    referee_credits: int
    expires_at: Optional[datetime]
    is_active: bool
    
    class Config:
        from_attributes = True


@router.get("/plans", response_model=List[PlanResponse])
async def get_plans(
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get all available subscription plans.
    """
    result = await db.execute(
        select(Plan)
        .where(Plan.is_active == True)
        .order_by(Plan.sort_order, Plan.price_monthly)
    )
    plans = result.scalars().all()
    
    plan_responses = []
    for plan in plans:
        plan_dict = {
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
            "features": json.loads(plan.features) if plan.features else {},
            "is_popular": plan.type == PlanType.PRO  # Mark Pro as popular
        }
        plan_responses.append(PlanResponse(**plan_dict))
    
    return plan_responses


@router.get("/current", response_model=SubscriptionResponse)
async def get_current_subscription(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get current user's subscription.
    """
    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == current_user.id)
        .options(selectinload(Subscription.plan))
    )
    subscription = result.scalar_one_or_none()
    
    if not subscription:
        # Create free tier subscription
        free_plan_result = await db.execute(
            select(Plan).where(Plan.type == PlanType.FREE)
        )
        free_plan = free_plan_result.scalar_one_or_none()
        
        if not free_plan:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Free plan not configured"
            )
        
        subscription = Subscription(
            user_id=current_user.id,
            plan_id=free_plan.id,
            status=SubscriptionStatus.ACTIVE,
            current_credits=settings.free_tier_credits,
            current_period_start=datetime.utcnow(),
            current_period_end=datetime.utcnow() + timedelta(days=30)
        )
        
        db.add(subscription)
        await db.commit()
        await db.refresh(subscription)
    
    # Convert to response model
    plan_dict = {
        "id": str(subscription.plan.id),
        "name": subscription.plan.name,
        "type": subscription.plan.type,
        "description": subscription.plan.description,
        "price_monthly": subscription.plan.price_monthly,
        "price_yearly": subscription.plan.price_yearly,
        "ai_credits": subscription.plan.ai_credits,
        "storage_gb": subscription.plan.storage_gb,
        "max_team_members": subscription.plan.max_team_members,
        "max_boards": subscription.plan.max_boards,
        "features": json.loads(subscription.plan.features) if subscription.plan.features else {}
    }
    
    response_dict = {
        "id": str(subscription.id),
        "status": subscription.status,
        "is_yearly": subscription.is_yearly,
        "current_credits": subscription.current_credits,
        "current_period_start": subscription.current_period_start,
        "current_period_end": subscription.current_period_end,
        "trial_end": subscription.trial_end,
        "plan": PlanResponse(**plan_dict)
    }
    
    return SubscriptionResponse(**response_dict)


@router.post("/create", response_model=dict)
async def create_subscription(
    request: CreateSubscriptionRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_async_session)
):
    """
    Create a new subscription with Stripe.
    """
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe not configured"
        )
    
    # Get plan
    result = await db.execute(
        select(Plan).where(Plan.id == request.plan_id)
    )
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found"
        )
    
    if plan.type == PlanType.FREE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create subscription for free plan"
        )
    
    try:
        # Create or get Stripe customer
        customer = None
        if current_user.subscription and current_user.subscription.stripe_customer_id:
            customer = stripe.Customer.retrieve(current_user.subscription.stripe_customer_id)
        else:
            customer = stripe.Customer.create(
                email=current_user.email,
                name=current_user.full_name,
                metadata={
                    "user_id": str(current_user.id),
                    "username": current_user.username
                }
            )
        
        # Attach payment method
        stripe.PaymentMethod.attach(
            request.payment_method_id,
            customer=customer.id
        )
        
        # Set as default payment method
        stripe.Customer.modify(
            customer.id,
            invoice_settings={
                "default_payment_method": request.payment_method_id
            }
        )
        
        # Get price ID
        price_id = (
            plan.stripe_price_id_yearly if request.is_yearly 
            else plan.stripe_price_id_monthly
        )
        
        if not price_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Price not configured for this plan"
            )
        
        # Create subscription
        subscription_params = {
            "customer": customer.id,
            "items": [{"price": price_id}],
            "payment_behavior": "default_incomplete",
            "payment_settings": {"save_default_payment_method": "on_subscription"},
            "expand": ["latest_invoice.payment_intent"],
            "metadata": {
                "user_id": str(current_user.id),
                "plan_id": str(plan.id)
            }
        }
        
        # Apply coupon if provided
        if request.coupon_code:
            subscription_params["coupon"] = request.coupon_code
        
        stripe_subscription = stripe.Subscription.create(**subscription_params)
        
        # Create or update local subscription
        existing_subscription = await db.execute(
            select(Subscription).where(Subscription.user_id == current_user.id)
        )
        existing = existing_subscription.scalar_one_or_none()
        
        if existing:
            # Update existing subscription
            existing.stripe_subscription_id = stripe_subscription.id
            existing.stripe_customer_id = customer.id
            existing.stripe_price_id = price_id
            existing.plan_id = plan.id
            existing.status = SubscriptionStatus.TRIALING
            existing.is_yearly = request.is_yearly
            existing.current_credits = plan.ai_credits
            existing.trial_start = datetime.utcnow()
            existing.trial_end = datetime.utcnow() + timedelta(days=14)
            subscription = existing
        else:
            # Create new subscription
            subscription = Subscription(
                user_id=current_user.id,
                plan_id=plan.id,
                stripe_subscription_id=stripe_subscription.id,
                stripe_customer_id=customer.id,
                stripe_price_id=price_id,
                status=SubscriptionStatus.TRIALING,
                is_yearly=request.is_yearly,
                current_credits=plan.ai_credits,
                trial_start=datetime.utcnow(),
                trial_end=datetime.utcnow() + timedelta(days=14)
            )
            db.add(subscription)
        
        await db.commit()
        
        return {
            "subscription_id": stripe_subscription.id,
            "client_secret": stripe_subscription.latest_invoice.payment_intent.client_secret,
            "status": stripe_subscription.status
        }
        
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )


@router.put("/update")
async def update_subscription(
    request: UpdateSubscriptionRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_async_session)
):
    """
    Update subscription plan.
    """
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe not configured"
        )
    
    # Get current subscription
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = result.scalar_one_or_none()
    
    if not subscription or not subscription.stripe_subscription_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription found"
        )
    
    try:
        if request.plan_id:
            # Get new plan
            plan_result = await db.execute(
                select(Plan).where(Plan.id == request.plan_id)
            )
            new_plan = plan_result.scalar_one_or_none()
            
            if not new_plan:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Plan not found"
                )
            
            # Update Stripe subscription
            is_yearly = request.is_yearly if request.is_yearly is not None else subscription.is_yearly
            price_id = (
                new_plan.stripe_price_id_yearly if is_yearly 
                else new_plan.stripe_price_id_monthly
            )
            
            stripe_subscription = stripe.Subscription.retrieve(subscription.stripe_subscription_id)
            stripe.Subscription.modify(
                subscription.stripe_subscription_id,
                items=[{
                    "id": stripe_subscription["items"]["data"][0].id,
                    "price": price_id,
                }],
                proration_behavior="create_prorations"
            )
            
            # Update local subscription
            subscription.plan_id = new_plan.id
            subscription.stripe_price_id = price_id
            subscription.is_yearly = is_yearly
            
        await db.commit()
        
        return {"message": "Subscription updated successfully"}
        
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )


@router.post("/cancel")
async def cancel_subscription(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_async_session)
):
    """
    Cancel subscription.
    """
    # Get current subscription
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = result.scalar_one_or_none()
    
    if not subscription or not subscription.stripe_subscription_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription found"
        )
    
    try:
        # Cancel at period end
        stripe.Subscription.modify(
            subscription.stripe_subscription_id,
            cancel_at_period_end=True
        )
        
        # Update local subscription
        subscription.canceled_at = datetime.utcnow()
        await db.commit()
        
        return {"message": "Subscription will be canceled at the end of the current period"}
        
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stripe error: {str(e)}"
        )


@router.get("/usage", response_model=UsageStatsResponse)
async def get_usage_stats(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get usage statistics for current period.
    """
    # Get current subscription
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = result.scalar_one_or_none()
    
    if not subscription:
        return UsageStatsResponse(
            current_period_usage={},
            total_credits_used=0,
            credits_remaining=0,
            daily_usage=[],
            usage_by_type={}
        )
    
    # Get current period usage
    period_start = subscription.current_period_start or datetime.utcnow()
    period_end = subscription.current_period_end or datetime.utcnow()
    
    usage_result = await db.execute(
        select(func.sum(UsageRecord.credits_used))
        .where(
            UsageRecord.user_id == current_user.id,
            UsageRecord.timestamp >= period_start,
            UsageRecord.timestamp <= period_end
        )
    )
    total_usage = usage_result.scalar() or 0
    
    # Get usage by type
    usage_by_type_result = await db.execute(
        select(UsageRecord.usage_type, func.sum(UsageRecord.credits_used))
        .where(
            UsageRecord.user_id == current_user.id,
            UsageRecord.timestamp >= period_start,
            UsageRecord.timestamp <= period_end
        )
        .group_by(UsageRecord.usage_type)
    )
    usage_by_type = dict(usage_by_type_result.all())
    
    # Get daily usage for the last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    daily_usage_result = await db.execute(
        select(
            func.date(UsageRecord.timestamp).label("date"),
            func.sum(UsageRecord.credits_used).label("credits")
        )
        .where(
            UsageRecord.user_id == current_user.id,
            UsageRecord.timestamp >= thirty_days_ago
        )
        .group_by(func.date(UsageRecord.timestamp))
        .order_by(func.date(UsageRecord.timestamp))
    )
    
    daily_usage = [
        {"date": row.date.isoformat(), "credits": row.credits}
        for row in daily_usage_result.all()
    ]
    
    return UsageStatsResponse(
        current_period_usage={"total": total_usage},
        total_credits_used=total_usage,
        credits_remaining=max(0, subscription.current_credits - total_usage),
        daily_usage=daily_usage,
        usage_by_type=usage_by_type
    )


@router.post("/referral/create", response_model=ReferralCodeResponse)
async def create_referral_code(
    request: CreateReferralCodeRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_async_session)
):
    """
    Create a referral code.
    """
    # Generate code
    if request.custom_code:
        code = request.custom_code.upper()
        # Check if code exists
        result = await db.execute(
            select(ReferralCode).where(ReferralCode.code == code)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Referral code already exists"
            )
    else:
        # Generate random code
        while True:
            code = shortuuid.ShortUUID().random(length=8).upper()
            result = await db.execute(
                select(ReferralCode).where(ReferralCode.code == code)
            )
            if not result.scalar_one_or_none():
                break
    
    # Calculate expiration
    expires_at = None
    if request.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=request.expires_in_days)
    
    # Create referral code
    referral_code = ReferralCode(
        code=code,
        user_id=current_user.id,
        max_uses=request.max_uses,
        expires_at=expires_at,
        referrer_credits=settings.referrer_credit_bonus,
        referee_credits=settings.referral_credit_bonus
    )
    
    db.add(referral_code)
    await db.commit()
    await db.refresh(referral_code)
    
    return ReferralCodeResponse(
        id=str(referral_code.id),
        code=referral_code.code,
        uses_count=referral_code.uses_count,
        max_uses=referral_code.max_uses,
        referrer_credits=referral_code.referrer_credits,
        referee_credits=referral_code.referee_credits,
        expires_at=referral_code.expires_at,
        is_active=referral_code.is_active
    )


@router.get("/referral/codes", response_model=List[ReferralCodeResponse])
async def get_referral_codes(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_async_session)
):
    """
    Get user's referral codes.
    """
    result = await db.execute(
        select(ReferralCode)
        .where(ReferralCode.user_id == current_user.id)
        .order_by(ReferralCode.created_at.desc())
    )
    codes = result.scalars().all()
    
    return [
        ReferralCodeResponse(
            id=str(code.id),
            code=code.code,
            uses_count=code.uses_count,
            max_uses=code.max_uses,
            referrer_credits=code.referrer_credits,
            referee_credits=code.referee_credits,
            expires_at=code.expires_at,
            is_active=code.is_active
        )
        for code in codes
    ]