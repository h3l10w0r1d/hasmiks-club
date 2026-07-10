"""add recurring membership billing fields (Ameriabank card binding)

Revision ID: 0022
Revises: 0021
Create Date: 2026-07-24
"""
from datetime import datetime, timedelta, timezone

from alembic import op
import sqlalchemy as sa

revision = '0022'
down_revision = '0021'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('card_holder_id', sa.String(64), nullable=True))
    op.add_column('users', sa.Column('binding_active', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('next_billing_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('renewal_attempts', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('card_required_by', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_users_card_holder_id', 'users', ['card_holder_id'], unique=True)

    # Existing perpetually-active members (no card, no expiry) get a 60-day
    # window to add a card before the same past_due/lapse rules that apply
    # to a real failed renewal start applying to them too.
    conn = op.get_bind()
    deadline = datetime.now(timezone.utc) + timedelta(days=60)
    conn.execute(
        sa.text("""
            UPDATE users
            SET card_required_by = :deadline
            WHERE membership_status = 'active' AND membership_expires_at IS NULL
        """),
        {"deadline": deadline},
    )


def downgrade():
    op.drop_index('ix_users_card_holder_id', table_name='users')
    op.drop_column('users', 'card_required_by')
    op.drop_column('users', 'renewal_attempts')
    op.drop_column('users', 'next_billing_date')
    op.drop_column('users', 'binding_active')
    op.drop_column('users', 'card_holder_id')
