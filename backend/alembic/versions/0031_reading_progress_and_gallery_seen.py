"""add reading progress and gallery last-seen tracking

Revision ID: 0031
Revises: 0030
Create Date: 2026-08-05

Backs the dashboard redesign's "currently reading" library card (a
self-reported 0-100 progress value, since content is a downloadable file
with no in-app reader to track automatically) and the gallery's "N new
photos" badge (a per-user last-visited timestamp compared against each
photo's created_at).
"""
from alembic import op
import sqlalchemy as sa

revision = '0031'
down_revision = '0030'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('member_content', sa.Column('progress', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('album_photos', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.add_column('users', sa.Column('gallery_last_seen_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column('users', 'gallery_last_seen_at')
    op.drop_column('album_photos', 'created_at')
    op.drop_column('member_content', 'progress')
