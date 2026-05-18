"""roles and permissions

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('role', sa.String(20), nullable=False, server_default='member'))
    op.add_column('users', sa.Column('permissions', sa.Text, nullable=True))
    # Migrate existing is_admin=true users to role='admin'
    op.execute("UPDATE users SET role = 'admin' WHERE is_admin = true")


def downgrade():
    op.drop_column('users', 'permissions')
    op.drop_column('users', 'role')
