"""bio, referral codes, application flow, app_settings, albums

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users: bio, referral, application ────────────────────────────────────
    op.add_column('users', sa.Column('bio', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('referral_code', sa.String(16), nullable=True))
    op.add_column('users', sa.Column('referred_by_id', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('application_message', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('application_status', sa.String(20), nullable=False, server_default='approved'))
    op.add_column('users', sa.Column('onboarding_completed', sa.Boolean(), nullable=False, server_default='false'))

    op.create_index('ix_users_referral_code', 'users', ['referral_code'], unique=True)
    op.create_foreign_key('fk_users_referred_by', 'users', 'users', ['referred_by_id'], ['id'])

    # ── app_settings ─────────────────────────────────────────────────────────
    op.create_table(
        'app_settings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('key', sa.String(64), nullable=False, unique=True),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # ── albums ────────────────────────────────────────────────────────────────
    op.create_table(
        'albums',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('event_id', sa.Integer(), sa.ForeignKey('events.id', ondelete='SET NULL'), nullable=True),
        sa.Column('cover_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        'album_photos',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('album_id', sa.Integer(), sa.ForeignKey('albums.id', ondelete='CASCADE'), nullable=False),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('caption', sa.String(300), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_table('album_photos')
    op.drop_table('albums')
    op.drop_table('app_settings')
    op.drop_constraint('fk_users_referred_by', 'users', type_='foreignkey')
    op.drop_index('ix_users_referral_code', table_name='users')
    op.drop_column('users', 'onboarding_completed')
    op.drop_column('users', 'application_status')
    op.drop_column('users', 'application_message')
    op.drop_column('users', 'referred_by_id')
    op.drop_column('users', 'referral_code')
    op.drop_column('users', 'bio')
