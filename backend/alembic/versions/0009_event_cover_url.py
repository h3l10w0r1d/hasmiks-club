"""add cover_url to events

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-01
"""
from alembic import op
import sqlalchemy as sa

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('events', sa.Column('cover_url', sa.String(), nullable=True))


def downgrade():
    op.drop_column('events', 'cover_url')
