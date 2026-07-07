"""add telegram sign-in support (telegram_id, nullable email)

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa

revision = '0015'
down_revision = '0014'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('telegram_id', sa.BigInteger(), nullable=True))
    op.create_index('ix_users_telegram_id', 'users', ['telegram_id'], unique=True)
    op.alter_column('users', 'email', existing_type=sa.String(), nullable=True)


def downgrade():
    op.alter_column('users', 'email', existing_type=sa.String(), nullable=False)
    op.drop_index('ix_users_telegram_id', table_name='users')
    op.drop_column('users', 'telegram_id')
