"""add notification_prefs to users

Revision ID: 0023
Revises: 0022
Create Date: 2026-07-19
"""
from alembic import op
import sqlalchemy as sa

revision = '0023'
down_revision = '0022'
branch_labels = None
depends_on = None


def upgrade():
    # JSON object of {type: {"in_app": bool, "push": bool}}. NULL/missing
    # type/channel all default to enabled — see app/core/notify.py.
    op.add_column('users', sa.Column('notification_prefs', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('users', 'notification_prefs')
