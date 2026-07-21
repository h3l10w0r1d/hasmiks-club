"""add optional map_url to events

Revision ID: 0025
Revises: 0024
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = '0025'
down_revision = '0024'
branch_labels = None
depends_on = None


def upgrade():
    # Optional Yandex Maps (or any map provider) link so members can see the
    # event location on a map — purely a convenience link, no geocoding.
    op.add_column('events', sa.Column('map_url', sa.String(), nullable=True))


def downgrade():
    op.drop_column('events', 'map_url')
