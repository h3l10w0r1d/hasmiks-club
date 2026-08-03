"""replace subscriptions with one-time credit packages

Revision ID: 0030
Revises: 0029
Create Date: 2026-07-26

The recurring-subscription model (plan tiers, monthly RSVP caps, Ameriabank
card-binding renewals) is being replaced with one-time "packages" — a flat
purchase for N event credits, optionally expiring after a validity window.
Adds member_packages (the credit ledger + payment-tracking row, one per
purchase or gift delivery), a member_package_id on rsvps (so a cancelled
RSVP can refund the exact credit it spent), and package snapshot columns on
gift_cards (membership gifts now deliver a credit pack instead of extending
a duration). All prior subscription columns/tables are left untouched — see
app/core/billing.py and app/routers/payments.py, both commented SUPERSEDED
rather than removed.
"""
from alembic import op
import sqlalchemy as sa

revision = '0030'
down_revision = '0029'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'member_packages',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('package_key', sa.String(64), nullable=True),
        sa.Column('name_en', sa.String(), nullable=False),
        sa.Column('name_hy', sa.String(), nullable=False),
        sa.Column('event_count', sa.Integer(), nullable=False),
        sa.Column('credits_remaining', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('validity_days', sa.Integer(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='051'),
        sa.Column('order_id', sa.Integer(), nullable=True),
        sa.Column('payment_id', sa.String(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='started'),
        sa.Column('response_code', sa.String(20), nullable=True),
        sa.Column('response_message', sa.String(255), nullable=True),
        sa.Column('card_number', sa.String(20), nullable=True),
        sa.Column('approval_code', sa.String(20), nullable=True),
        sa.Column('rrn', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_member_packages_order_id', 'member_packages', ['order_id'], unique=True)
    op.create_index('ix_member_packages_payment_id', 'member_packages', ['payment_id'])

    op.add_column('rsvps', sa.Column('member_package_id', sa.Integer(), sa.ForeignKey('member_packages.id', ondelete='SET NULL'), nullable=True))

    op.add_column('gift_cards', sa.Column('package_key', sa.String(64), nullable=True))
    op.add_column('gift_cards', sa.Column('package_event_count', sa.Integer(), nullable=True))
    op.add_column('gift_cards', sa.Column('package_validity_days', sa.Integer(), nullable=True))

    op.create_table(
        'member_package_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('member_package_id', sa.Integer(), sa.ForeignKey('member_packages.id'), nullable=False),
        sa.Column('event', sa.String(40), nullable=False),
        sa.Column('success', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('request_payload', sa.Text(), nullable=True),
        sa.Column('response_payload', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_member_package_logs_member_package_id', 'member_package_logs', ['member_package_id'])


def downgrade():
    op.drop_index('ix_member_package_logs_member_package_id', table_name='member_package_logs')
    op.drop_table('member_package_logs')
    op.drop_column('gift_cards', 'package_validity_days')
    op.drop_column('gift_cards', 'package_event_count')
    op.drop_column('gift_cards', 'package_key')
    op.drop_column('rsvps', 'member_package_id')
    op.drop_index('ix_member_packages_payment_id', table_name='member_packages')
    op.drop_index('ix_member_packages_order_id', table_name='member_packages')
    op.drop_table('member_packages')
