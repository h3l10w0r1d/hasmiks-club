"""add guest ticket email verification + QR check-in fields

Revision ID: 0017
Revises: 0016
Create Date: 2026-07-10
"""
from alembic import op
import sqlalchemy as sa

revision = '0017'
down_revision = '0016'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('guest_tickets', sa.Column('email_verified', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('guest_tickets', sa.Column('verification_code', sa.String(6), nullable=True))
    op.add_column('guest_tickets', sa.Column('verification_sent_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('guest_tickets', sa.Column('verification_attempts', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('guest_tickets', sa.Column('checkin_token', sa.String(32), nullable=True))
    op.create_index('ix_guest_tickets_checkin_token', 'guest_tickets', ['checkin_token'], unique=True)


def downgrade():
    op.drop_index('ix_guest_tickets_checkin_token', table_name='guest_tickets')
    op.drop_column('guest_tickets', 'checkin_token')
    op.drop_column('guest_tickets', 'verification_attempts')
    op.drop_column('guest_tickets', 'verification_sent_at')
    op.drop_column('guest_tickets', 'verification_code')
    op.drop_column('guest_tickets', 'email_verified')
