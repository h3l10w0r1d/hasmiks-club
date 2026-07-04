"""add ameria_payment_logs table

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-05
"""
from alembic import op
import sqlalchemy as sa

revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ameria_payment_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('payment_row_id', sa.Integer(), sa.ForeignKey('ameria_payments.id'), nullable=False),
        sa.Column('event', sa.String(length=40), nullable=False),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('request_payload', sa.Text(), nullable=True),
        sa.Column('response_payload', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ameria_payment_logs_id', 'ameria_payment_logs', ['id'])
    op.create_index('ix_ameria_payment_logs_payment_row_id', 'ameria_payment_logs', ['payment_row_id'])


def downgrade():
    op.drop_index('ix_ameria_payment_logs_payment_row_id', table_name='ameria_payment_logs')
    op.drop_index('ix_ameria_payment_logs_id', table_name='ameria_payment_logs')
    op.drop_table('ameria_payment_logs')
