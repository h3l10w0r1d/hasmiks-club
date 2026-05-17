"""add checked_in to rsvps and admin_notes to users

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('rsvps',  sa.Column('checked_in', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users',  sa.Column('admin_notes', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('rsvps', 'checked_in')
    op.drop_column('users',  'admin_notes')
