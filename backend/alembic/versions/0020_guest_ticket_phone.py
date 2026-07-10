"""add phone to guest_tickets

Revision ID: 0020
Revises: 0019
Create Date: 2026-07-17
"""
from alembic import op
import sqlalchemy as sa

revision = '0020'
down_revision = '0019'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('guest_tickets', sa.Column('phone', sa.String(32), nullable=True))


def downgrade():
    op.drop_column('guest_tickets', 'phone')
