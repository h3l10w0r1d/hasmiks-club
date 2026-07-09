"""add one-time guest event tickets (event ticket_price/max_guest_tickets, guest_tickets table)

Revision ID: 0016
Revises: 0015
Create Date: 2026-07-09
"""
from alembic import op
import sqlalchemy as sa

revision = '0016'
down_revision = '0015'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('events', sa.Column('ticket_price', sa.Numeric(12, 2), nullable=True))
    op.add_column('events', sa.Column('max_guest_tickets', sa.Integer(), nullable=True))

    op.create_table(
        'guest_tickets',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('event_id', sa.Integer(), sa.ForeignKey('events.id', ondelete='CASCADE'), nullable=False),
        sa.Column('full_name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
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
        sa.Column('checked_in', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_guest_tickets_event_id', 'guest_tickets', ['event_id'])
    op.create_index('ix_guest_tickets_email', 'guest_tickets', ['email'])
    op.create_index('ix_guest_tickets_order_id', 'guest_tickets', ['order_id'], unique=True)
    op.create_index('ix_guest_tickets_payment_id', 'guest_tickets', ['payment_id'])


def downgrade():
    op.drop_index('ix_guest_tickets_payment_id', table_name='guest_tickets')
    op.drop_index('ix_guest_tickets_order_id', table_name='guest_tickets')
    op.drop_index('ix_guest_tickets_email', table_name='guest_tickets')
    op.drop_index('ix_guest_tickets_event_id', table_name='guest_tickets')
    op.drop_table('guest_tickets')
    op.drop_column('events', 'max_guest_tickets')
    op.drop_column('events', 'ticket_price')
