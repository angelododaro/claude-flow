"""
Webhook handlers for external services.
"""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import stripe
import hmac
import hashlib
import json
from datetime import datetime

from app.core.config import settings
from app.db.base import get_async_session
from app.models.user import User
from app.models.subscription import (
    Subscription, Plan, SubscriptionStatus, 
    UsageRecord, ReferralCode, Referral
)


router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Configure Stripe
if settings.stripe_secret_key:
    stripe.api_key = settings.stripe_secret_key


@router.post("/stripe")
async def handle_stripe_webhook(
    request: Request,
    stripe_signature: Annotated[str, Header(alias="stripe-signature")],
    db: AsyncSession = Depends(get_async_session)
):
    """
    Handle Stripe webhook events.
    """
    if not settings.stripe_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe webhook secret not configured"
        )
    
    body = await request.body()
    
    try:
        # Verify webhook signature
        event = stripe.Webhook.construct_event(
            body, stripe_signature, settings.stripe_webhook_secret
        )
    except ValueError:
        # Invalid payload
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payload"
        )
    except stripe.error.SignatureVerificationError:
        # Invalid signature
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature"
        )
    
    # Handle the event
    event_type = event['type']
    event_data = event['data']['object']
    
    try:
        if event_type == 'customer.subscription.created':
            await handle_subscription_created(event_data, db)
        
        elif event_type == 'customer.subscription.updated':
            await handle_subscription_updated(event_data, db)
        
        elif event_type == 'customer.subscription.deleted':
            await handle_subscription_deleted(event_data, db)
        
        elif event_type == 'invoice.payment_succeeded':
            await handle_payment_succeeded(event_data, db)
        
        elif event_type == 'invoice.payment_failed':
            await handle_payment_failed(event_data, db)
        
        elif event_type == 'customer.subscription.trial_will_end':
            await handle_trial_will_end(event_data, db)
        
        else:
            print(f"Unhandled event type: {event_type}")
    
    except Exception as e:
        print(f"Error handling webhook event {event_type}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing webhook"
        )
    
    return {"status": "success"}


async def handle_subscription_created(event_data: dict, db: AsyncSession):
    """Handle subscription.created event."""
    stripe_subscription_id = event_data['id']
    stripe_customer_id = event_data['customer']
    status = event_data['status']
    
    # Get subscription from database
    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    subscription = result.scalar_one_or_none()
    
    if subscription:
        # Update subscription status
        subscription.status = SubscriptionStatus(status.lower())
        subscription.current_period_start = datetime.fromtimestamp(
            event_data['current_period_start']
        )
        subscription.current_period_end = datetime.fromtimestamp(
            event_data['current_period_end']
        )
        
        if event_data.get('trial_start'):
            subscription.trial_start = datetime.fromtimestamp(
                event_data['trial_start']
            )
        
        if event_data.get('trial_end'):
            subscription.trial_end = datetime.fromtimestamp(
                event_data['trial_end']
            )
        
        await db.commit()


async def handle_subscription_updated(event_data: dict, db: AsyncSession):
    """Handle subscription.updated event."""
    stripe_subscription_id = event_data['id']
    status = event_data['status']
    
    # Get subscription from database
    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    subscription = result.scalar_one_or_none()
    
    if subscription:
        # Update subscription status and periods
        subscription.status = SubscriptionStatus(status.lower())
        subscription.current_period_start = datetime.fromtimestamp(
            event_data['current_period_start']
        )
        subscription.current_period_end = datetime.fromtimestamp(
            event_data['current_period_end']
        )
        
        # Handle cancellation
        if event_data.get('canceled_at'):
            subscription.canceled_at = datetime.fromtimestamp(
                event_data['canceled_at']
            )
        
        # Handle end date
        if event_data.get('ended_at'):
            subscription.ended_at = datetime.fromtimestamp(
                event_data['ended_at']
            )
        
        await db.commit()


async def handle_subscription_deleted(event_data: dict, db: AsyncSession):
    """Handle subscription.deleted event."""
    stripe_subscription_id = event_data['id']
    
    # Get subscription from database
    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    subscription = result.scalar_one_or_none()
    
    if subscription:
        subscription.status = SubscriptionStatus.CANCELED
        subscription.ended_at = datetime.fromtimestamp(
            event_data.get('ended_at', event_data['created'])
        )
        
        await db.commit()


async def handle_payment_succeeded(event_data: dict, db: AsyncSession):
    """Handle invoice.payment_succeeded event."""
    stripe_customer_id = event_data['customer']
    stripe_subscription_id = event_data.get('subscription')
    
    if not stripe_subscription_id:
        return  # Not a subscription payment
    
    # Get subscription from database
    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    subscription = result.scalar_one_or_none()
    
    if subscription:
        # Reset credits for new billing period
        plan_result = await db.execute(
            select(Plan).where(Plan.id == subscription.plan_id)
        )
        plan = plan_result.scalar_one_or_none()
        
        if plan:
            subscription.current_credits = plan.ai_credits
            subscription.total_credits_purchased += plan.ai_credits
            
            # Update subscription status to active
            subscription.status = SubscriptionStatus.ACTIVE
            
            await db.commit()


async def handle_payment_failed(event_data: dict, db: AsyncSession):
    """Handle invoice.payment_failed event."""
    stripe_customer_id = event_data['customer']
    stripe_subscription_id = event_data.get('subscription')
    
    if not stripe_subscription_id:
        return  # Not a subscription payment
    
    # Get subscription from database
    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    subscription = result.scalar_one_or_none()
    
    if subscription:
        # Mark subscription as past due
        subscription.status = SubscriptionStatus.PAST_DUE
        await db.commit()
        
        # TODO: Send notification to user about failed payment


async def handle_trial_will_end(event_data: dict, db: AsyncSession):
    """Handle customer.subscription.trial_will_end event."""
    stripe_subscription_id = event_data['id']
    
    # Get subscription from database
    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_subscription_id
        )
    )
    subscription = result.scalar_one_or_none()
    
    if subscription:
        # TODO: Send notification to user about trial ending
        print(f"Trial ending for subscription {subscription.id}")


@router.post("/referral-signup")
async def handle_referral_signup(
    request: Request,
    db: AsyncSession = Depends(get_async_session)
):
    """
    Handle referral signup webhook.
    This would be called when a user signs up with a referral code.
    """
    data = await request.json()
    
    referral_code = data.get('referral_code')
    user_id = data.get('user_id')
    
    if not referral_code or not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing referral code or user ID"
        )
    
    try:
        # Get referral code
        result = await db.execute(
            select(ReferralCode).where(
                ReferralCode.code == referral_code,
                ReferralCode.is_active == True
            )
        )
        referral_code_obj = result.scalar_one_or_none()
        
        if not referral_code_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid or inactive referral code"
            )
        
        # Check if code has expired or reached max uses
        if referral_code_obj.expires_at and referral_code_obj.expires_at < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Referral code has expired"
            )
        
        if (referral_code_obj.max_uses and 
            referral_code_obj.uses_count >= referral_code_obj.max_uses):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Referral code has reached maximum uses"
            )
        
        # Create referral record
        referral = Referral(
            referral_code_id=referral_code_obj.id,
            referrer_id=referral_code_obj.user_id,
            referee_id=user_id,
            referee_credits_awarded=referral_code_obj.referee_credits,
            is_completed=False
        )
        
        db.add(referral)
        
        # Update referral code usage count
        referral_code_obj.uses_count += 1
        
        # Add credits to referee's account
        referee_subscription_result = await db.execute(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        referee_subscription = referee_subscription_result.scalar_one_or_none()
        
        if referee_subscription:
            referee_subscription.current_credits += referral_code_obj.referee_credits
        
        await db.commit()
        
        return {
            "message": "Referral processed successfully",
            "credits_awarded": referral_code_obj.referee_credits
        }
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing referral: {str(e)}"
        )


@router.post("/complete-referral")
async def complete_referral(
    request: Request,
    db: AsyncSession = Depends(get_async_session)
):
    """
    Complete a referral when the referee upgrades to a paid plan.
    """
    data = await request.json()
    user_id = data.get('user_id')
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing user ID"
        )
    
    try:
        # Find incomplete referral for this user
        result = await db.execute(
            select(Referral).where(
                Referral.referee_id == user_id,
                Referral.is_completed == False
            )
        )
        referral = result.scalar_one_or_none()
        
        if not referral:
            return {"message": "No incomplete referral found"}
        
        # Mark referral as completed
        referral.is_completed = True
        referral.completed_at = datetime.utcnow()
        referral.referrer_credits_awarded = referral.referral_code.referrer_credits
        
        # Add credits to referrer's account
        referrer_subscription_result = await db.execute(
            select(Subscription).where(Subscription.user_id == referral.referrer_id)
        )
        referrer_subscription = referrer_subscription_result.scalar_one_or_none()
        
        if referrer_subscription:
            referrer_subscription.current_credits += referral.referral_code.referrer_credits
        
        await db.commit()
        
        return {
            "message": "Referral completed successfully",
            "referrer_credits_awarded": referral.referral_code.referrer_credits
        }
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error completing referral: {str(e)}"
        )