"""add membership plan tier to users and ameria_payments

Revision ID: 0028
Revises: 0027
Create Date: 2026-07-21

The Pricing section shows two membership tiers (different monthly prices),
but checkout always charged one fixed AMERIABANK_MEMBERSHIP_AMOUNT regardless
of which plan a member picked at the Subscribe button. Adds a plan tier
("1" | "2") to both the user (so recurring renewals know which price to
charge) and each payment attempt (audit trail of what was actually charged).
NULL means "no plan chosen" — falls back to the legacy fixed amount.
"""
from alembic import op
import sqlalchemy as sa

revision = '0028'
down_revision = '0027'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('membership_plan', sa.String(10), nullable=True))
    op.add_column('ameria_payments', sa.Column('plan', sa.String(10), nullable=True))


def downgrade():
    op.drop_column('ameria_payments', 'plan')
    op.drop_column('users', 'membership_plan')
