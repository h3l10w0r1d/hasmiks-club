"""add guest_ticket_logs table

Fixes a real bug: the guest-ticket checkout/callback flow was calling
log_payment_event(db, ticket.id, ...), but that function's target table
(ameria_payment_logs) has a foreign key pointing at ameria_payments.id
specifically — guest_tickets.id is a different, independent sequence, so
this would raise a ForeignKeyViolation the first time it ran for real
(caught via a live Postgres functional test, never hit in earlier testing
since those tests never reached a successful Ameriabank init_payment call).

Revision ID: 0018
Revises: 0017
Create Date: 2026-07-10
"""
from alembic import op
import sqlalchemy as sa

revision = '0018'
down_revision = '0017'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'guest_ticket_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('ticket_row_id', sa.Integer(), sa.ForeignKey('guest_tickets.id'), nullable=False),
        sa.Column('event', sa.String(40), nullable=False),
        sa.Column('success', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('request_payload', sa.Text(), nullable=True),
        sa.Column('response_payload', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_guest_ticket_logs_ticket_row_id', 'guest_ticket_logs', ['ticket_row_id'])


def downgrade():
    op.drop_index('ix_guest_ticket_logs_ticket_row_id', table_name='guest_ticket_logs')
    op.drop_table('guest_ticket_logs')
