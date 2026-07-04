"""add forum reactions + image_url columns

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-05
"""
from alembic import op
import sqlalchemy as sa

revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('forum_topics', sa.Column('image_url', sa.Text(), nullable=True))
    op.add_column('forum_posts', sa.Column('image_url', sa.Text(), nullable=True))

    op.create_table(
        'forum_reactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target_type', sa.String(length=10), nullable=False),
        sa.Column('target_id', sa.Integer(), nullable=False),
        sa.Column('emoji', sa.String(length=16), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'target_type', 'target_id', 'emoji', name='uq_forum_reaction'),
    )
    op.create_index('ix_forum_reactions_id', 'forum_reactions', ['id'])
    op.create_index('ix_forum_reactions_target', 'forum_reactions', ['target_type', 'target_id'])


def downgrade():
    op.drop_index('ix_forum_reactions_target', table_name='forum_reactions')
    op.drop_index('ix_forum_reactions_id', table_name='forum_reactions')
    op.drop_table('forum_reactions')
    op.drop_column('forum_posts', 'image_url')
    op.drop_column('forum_topics', 'image_url')
