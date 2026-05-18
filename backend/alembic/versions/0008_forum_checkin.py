"""forum topics/posts + event checkin_token

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-18
"""
from alembic import op
import sqlalchemy as sa
import secrets

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None

def upgrade():
    # Forum topics
    op.create_table('forum_topics',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('body', sa.Text, nullable=False),
        sa.Column('category', sa.String(50), nullable=False, server_default='general'),
        sa.Column('pinned', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('is_deleted', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('post_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # Forum posts (replies)
    op.create_table('forum_posts',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('topic_id', sa.Integer, sa.ForeignKey('forum_topics.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('body', sa.Text, nullable=False),
        sa.Column('is_deleted', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # Event checkin token
    op.add_column('events', sa.Column('checkin_token', sa.String(32), nullable=True))

def downgrade():
    op.drop_column('events', 'checkin_token')
    op.drop_table('forum_posts')
    op.drop_table('forum_topics')
