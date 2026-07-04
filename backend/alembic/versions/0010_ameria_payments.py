"""add ameria_payments table, drop stripe_customer_id (replacing Stripe with Ameriabank vPOS)

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-04
"""
from alembic import op
import sqlalchemy as sa

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ameria_payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('payment_id', sa.String(), nullable=True),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='051'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='started'),
        sa.Column('response_code', sa.String(length=20), nullable=True),
        sa.Column('response_message', sa.String(length=255), nullable=True),
        sa.Column('card_number', sa.String(length=20), nullable=True),
        sa.Column('approval_code', sa.String(length=20), nullable=True),
        sa.Column('rrn', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ameria_payments_id', 'ameria_payments', ['id'])
    op.create_index('ix_ameria_payments_order_id', 'ameria_payments', ['order_id'], unique=True)
    op.create_index('ix_ameria_payments_payment_id', 'ameria_payments', ['payment_id'])
    op.drop_column('users', 'stripe_customer_id')


def downgrade():
    op.add_column('users', sa.Column('stripe_customer_id', sa.String(), nullable=True))
    op.drop_index('ix_ameria_payments_payment_id', table_name='ameria_payments')
    op.drop_index('ix_ameria_payments_order_id', table_name='ameria_payments')
    op.drop_index('ix_ameria_payments_id', table_name='ameria_payments')
    op.drop_table('ameria_payments')
