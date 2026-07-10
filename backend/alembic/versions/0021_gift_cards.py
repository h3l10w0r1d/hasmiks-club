"""add gift cards (membership + one-time-event gifts)

Revision ID: 0021
Revises: 0020
Create Date: 2026-07-17
"""
from alembic import op
import sqlalchemy as sa

revision = '0021'
down_revision = '0020'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('membership_expires_at', sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        'gift_cards',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('giver_name', sa.String(), nullable=False),
        sa.Column('giver_email', sa.String(), nullable=False),
        sa.Column('giver_phone', sa.String(32), nullable=True),
        sa.Column('recipient_name', sa.String(), nullable=False),
        sa.Column('recipient_email', sa.String(), nullable=False),
        sa.Column('recipient_phone', sa.String(32), nullable=True),
        sa.Column('anonymous', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('gift_type', sa.String(20), nullable=False),
        sa.Column('duration_months', sa.Integer(), nullable=True),
        sa.Column('event_selections_json', sa.String(), nullable=True),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('currency', sa.String(3), nullable=False, server_default='051'),
        sa.Column('order_id', sa.Integer(), nullable=True),
        sa.Column('payment_id', sa.String(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='unverified'),
        sa.Column('response_code', sa.String(20), nullable=True),
        sa.Column('response_message', sa.String(255), nullable=True),
        sa.Column('card_number', sa.String(20), nullable=True),
        sa.Column('approval_code', sa.String(20), nullable=True),
        sa.Column('rrn', sa.String(64), nullable=True),
        sa.Column('email_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('verification_code', sa.String(6), nullable=True),
        sa.Column('verification_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verification_attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('redemption_token', sa.String(43), nullable=True),
        sa.Column('redeemed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('redeemed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('applied_to_user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_gift_cards_giver_email', 'gift_cards', ['giver_email'])
    op.create_index('ix_gift_cards_recipient_email', 'gift_cards', ['recipient_email'])
    op.create_index('ix_gift_cards_order_id', 'gift_cards', ['order_id'], unique=True)
    op.create_index('ix_gift_cards_payment_id', 'gift_cards', ['payment_id'])
    op.create_index('ix_gift_cards_redemption_token', 'gift_cards', ['redemption_token'], unique=True)

    op.create_table(
        'gift_card_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('gift_card_id', sa.Integer(), sa.ForeignKey('gift_cards.id'), nullable=False),
        sa.Column('event', sa.String(40), nullable=False),
        sa.Column('success', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('request_payload', sa.Text(), nullable=True),
        sa.Column('response_payload', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_gift_card_logs_gift_card_id', 'gift_card_logs', ['gift_card_id'])

    op.add_column('guest_tickets', sa.Column('gift_card_id', sa.Integer(), sa.ForeignKey('gift_cards.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_guest_tickets_gift_card_id', 'guest_tickets', ['gift_card_id'])


def downgrade():
    op.drop_index('ix_guest_tickets_gift_card_id', table_name='guest_tickets')
    op.drop_column('guest_tickets', 'gift_card_id')

    op.drop_index('ix_gift_card_logs_gift_card_id', table_name='gift_card_logs')
    op.drop_table('gift_card_logs')

    op.drop_index('ix_gift_cards_redemption_token', table_name='gift_cards')
    op.drop_index('ix_gift_cards_payment_id', table_name='gift_cards')
    op.drop_index('ix_gift_cards_order_id', table_name='gift_cards')
    op.drop_index('ix_gift_cards_recipient_email', table_name='gift_cards')
    op.drop_index('ix_gift_cards_giver_email', table_name='gift_cards')
    op.drop_table('gift_cards')

    op.drop_column('users', 'membership_expires_at')
