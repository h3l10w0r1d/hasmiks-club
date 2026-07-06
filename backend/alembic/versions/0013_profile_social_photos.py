"""add profile social links + personal photo gallery

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-06
"""
from alembic import op
import sqlalchemy as sa

revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('facebook_url', sa.String(), nullable=True))
    op.add_column('users', sa.Column('telegram_username', sa.String(length=64), nullable=True))
    op.add_column('users', sa.Column('phone', sa.String(length=32), nullable=True))
    op.add_column('users', sa.Column('whatsapp', sa.String(length=32), nullable=True))

    op.create_table(
        'profile_photos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_profile_photos_id', 'profile_photos', ['id'])
    op.create_index('ix_profile_photos_user_id', 'profile_photos', ['user_id'])


def downgrade():
    op.drop_index('ix_profile_photos_user_id', table_name='profile_photos')
    op.drop_index('ix_profile_photos_id', table_name='profile_photos')
    op.drop_table('profile_photos')
    op.drop_column('users', 'whatsapp')
    op.drop_column('users', 'phone')
    op.drop_column('users', 'telegram_username')
    op.drop_column('users', 'facebook_url')
