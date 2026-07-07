"""add google sign-in support (google_id, nullable password_hash)

Revision ID: 0014
Revises: 0013
Create Date: 2026-07-07
"""
from alembic import op
import sqlalchemy as sa

revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('google_id', sa.String(length=64), nullable=True))
    op.create_index('ix_users_google_id', 'users', ['google_id'], unique=True)
    op.alter_column('users', 'password_hash', existing_type=sa.String(), nullable=True)


def downgrade():
    op.alter_column('users', 'password_hash', existing_type=sa.String(), nullable=False)
    op.drop_index('ix_users_google_id', table_name='users')
    op.drop_column('users', 'google_id')
