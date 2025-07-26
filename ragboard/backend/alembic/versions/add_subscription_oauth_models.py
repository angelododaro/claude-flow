"""add subscription and oauth models

Revision ID: add_subscription_oauth_models
Revises: a5770e01b390
Create Date: 2025-07-26 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = 'add_subscription_oauth_models'
down_revision = 'a5770e01b390'
branch_labels = None
depends_on = None


def upgrade():
    # Add OAuth providers column to user table
    op.add_column('user', sa.Column('oauth_providers', sa.Text(), nullable=True))
    
    # Create plan table
    op.create_table('plan',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.String(length=100), unique=True, nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('price_monthly', sa.Integer(), default=0, nullable=False),
        sa.Column('price_yearly', sa.Integer(), default=0, nullable=False),
        sa.Column('stripe_price_id_monthly', sa.String(length=255), nullable=True),
        sa.Column('stripe_price_id_yearly', sa.String(length=255), nullable=True),
        sa.Column('ai_credits', sa.Integer(), default=0, nullable=False),
        sa.Column('storage_gb', sa.Integer(), default=1, nullable=False),
        sa.Column('max_team_members', sa.Integer(), default=1, nullable=False),
        sa.Column('max_boards', sa.Integer(), default=10, nullable=False),
        sa.Column('api_rate_limit', sa.Integer(), default=100, nullable=False),
        sa.Column('features', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('sort_order', sa.Integer(), default=0, nullable=False),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now(), nullable=False)
    )
    
    # Create subscription table
    op.create_table('subscription',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('stripe_subscription_id', sa.String(length=255), unique=True, nullable=True),
        sa.Column('stripe_customer_id', sa.String(length=255), nullable=True),
        sa.Column('stripe_price_id', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=20), default='active', nullable=False),
        sa.Column('is_yearly', sa.Boolean(), default=False, nullable=False),
        sa.Column('trial_start', sa.DateTime(), nullable=True),
        sa.Column('trial_end', sa.DateTime(), nullable=True),
        sa.Column('current_period_start', sa.DateTime(), nullable=True),
        sa.Column('current_period_end', sa.DateTime(), nullable=True),
        sa.Column('canceled_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('current_credits', sa.Integer(), default=0, nullable=False),
        sa.Column('total_credits_purchased', sa.Integer(), default=0, nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('plan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('plan.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now(), nullable=False)
    )
    
    # Create usage_record table
    op.create_table('usage_record',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('usage_type', sa.String(length=50), nullable=False),
        sa.Column('quantity', sa.Integer(), default=1, nullable=False),
        sa.Column('credits_used', sa.Integer(), default=1, nullable=False),
        sa.Column('metadata', sa.Text(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('subscription_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('subscription.id'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False)
    )
    
    # Create team table
    op.create_table('team',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=100), unique=True, index=True, nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('settings', sa.Text(), nullable=True),
        sa.Column('stripe_customer_id', sa.String(length=255), nullable=True),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now(), nullable=False)
    )
    
    # Create team_member table
    op.create_table('team_member',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('role', sa.String(length=20), default='member', nullable=False),
        sa.Column('invited_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('joined_at', sa.DateTime(), nullable=True),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('team.id'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False)
    )
    
    # Create referral_code table
    op.create_table('referral_code',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('code', sa.String(length=20), unique=True, index=True, nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('uses_count', sa.Integer(), default=0, nullable=False),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('referrer_credits', sa.Integer(), default=50, nullable=False),
        sa.Column('referee_credits', sa.Integer(), default=100, nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now(), nullable=False)
    )
    
    # Create referral table
    op.create_table('referral',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('referrer_credits_awarded', sa.Integer(), default=0, nullable=False),
        sa.Column('referee_credits_awarded', sa.Integer(), default=0, nullable=False),
        sa.Column('is_completed', sa.Boolean(), default=False, nullable=False),
        sa.Column('referred_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('referral_code_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('referral_code.id'), nullable=False),
        sa.Column('referrer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('referee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('user.id'), nullable=False)
    )
    
    # Create indexes
    op.create_index('ix_subscription_user_id', 'subscription', ['user_id'])
    op.create_index('ix_subscription_status', 'subscription', ['status'])
    op.create_index('ix_usage_record_user_id', 'usage_record', ['user_id'])
    op.create_index('ix_usage_record_timestamp', 'usage_record', ['timestamp'])
    op.create_index('ix_team_member_team_id', 'team_member', ['team_id'])
    op.create_index('ix_team_member_user_id', 'team_member', ['user_id'])
    
    # Insert default plans
    op.execute("""
        INSERT INTO plan (id, name, type, description, price_monthly, price_yearly, ai_credits, storage_gb, max_team_members, max_boards, api_rate_limit, features, sort_order)
        VALUES 
        (gen_random_uuid(), 'Free', 'free', 'Perfect for getting started', 0, 0, 100, 1, 1, 10, 100, '{"basic_features": true}', 1),
        (gen_random_uuid(), 'Basic', 'basic', 'For individuals and small teams', 999, 9990, 1000, 10, 3, 50, 500, '{"advanced_features": true, "priority_support": true}', 2),
        (gen_random_uuid(), 'Pro', 'pro', 'For growing teams and businesses', 2999, 29990, 10000, 100, 10, 200, 2000, '{"premium_features": true, "priority_support": true, "api_access": true}', 3),
        (gen_random_uuid(), 'Enterprise', 'enterprise', 'For large organizations', 9999, 99990, 100000, 1000, 50, 1000, 10000, '{"all_features": true, "dedicated_support": true, "custom_integrations": true}', 4)
    """)


def downgrade():
    # Drop tables in reverse order
    op.drop_table('referral')
    op.drop_table('referral_code')
    op.drop_table('team_member')
    op.drop_table('team')
    op.drop_table('usage_record')
    op.drop_table('subscription')
    op.drop_table('plan')
    
    # Remove OAuth column
    op.drop_column('user', 'oauth_providers')