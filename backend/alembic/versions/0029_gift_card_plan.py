"""add plan tier to gift_cards

Revision ID: 0029
Revises: 0028
Create Date: 2026-07-26

Gifted memberships priced off a flat gift_price_{months}m setting,
independent of the plan1/plan2 tiers introduced in 0028 — and never stamped
membership_plan on the recipient, so a gifted membership got unlimited
monthly RSVPs regardless of which tier it stood in for. Adds the same
plan ("1" | "2", NULL = legacy flat price) to gift_cards so gift pricing and
delivery can align with real subscriptions.
"""
from alembic import op
import sqlalchemy as sa

revision = '0029'
down_revision = '0028'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('gift_cards', sa.Column('plan', sa.String(10), nullable=True))


def downgrade():
    op.drop_column('gift_cards', 'plan')
