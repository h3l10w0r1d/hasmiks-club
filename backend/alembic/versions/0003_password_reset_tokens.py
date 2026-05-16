"""add password_reset_tokens table

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-17

"""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'password_reset_tokens',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token', sa.String(), unique=True, nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_password_reset_tokens_token', 'password_reset_tokens', ['token'])


def downgrade() -> None:
    op.drop_index('ix_password_reset_tokens_token', 'password_reset_tokens')
    op.drop_table('password_reset_tokens')
