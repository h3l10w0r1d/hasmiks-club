"""add forum_reports table (moderation queue)

Revision ID: 0024
Revises: 0023
Create Date: 2026-07-19
"""
from alembic import op
import sqlalchemy as sa

revision = '0024'
down_revision = '0023'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'forum_reports',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('reporter_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target_type', sa.String(10), nullable=False),
        sa.Column('target_id', sa.Integer(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_forum_reports_target', 'forum_reports', ['target_type', 'target_id'])
    op.create_index('ix_forum_reports_status', 'forum_reports', ['status'])


def downgrade():
    op.drop_index('ix_forum_reports_status', table_name='forum_reports')
    op.drop_index('ix_forum_reports_target', table_name='forum_reports')
    op.drop_table('forum_reports')
