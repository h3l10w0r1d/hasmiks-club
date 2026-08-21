"""add promo codes and redemptions

Revision ID: 0032
Revises: 0031
Create Date: 2026-08-21

Admin-created discount codes applied at package checkout. Benefits stack
(percent/amount off plus bonus credits) and every limit is optional — see
app/models/promo_code.py. Also adds the columns on member_packages that
snapshot what a purchase actually got, so a later edit to the code never
rewrites history.
"""
from alembic import op
import sqlalchemy as sa

revision = '0032'
down_revision = '0031'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'promo_codes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('code', sa.String(32), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('percent_off', sa.Integer(), nullable=True),
        sa.Column('amount_off', sa.Numeric(12, 2), nullable=True),
        sa.Column('bonus_credits', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('max_uses_per_user', sa.Integer(), nullable=True),
        sa.Column('package_keys', sa.Text(), nullable=True),
        sa.Column('times_used', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('created_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
    )
    op.create_index('ix_promo_codes_code', 'promo_codes', ['code'], unique=True)

    op.create_table(
        'promo_redemptions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('promo_code_id', sa.Integer(), sa.ForeignKey('promo_codes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('member_package_id', sa.Integer(), sa.ForeignKey('member_packages.id', ondelete='SET NULL'), nullable=True),
        sa.Column('discount_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('bonus_credits', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_promo_redemptions_promo_code_id', 'promo_redemptions', ['promo_code_id'])
    op.create_index('ix_promo_redemptions_user_id', 'promo_redemptions', ['user_id'])

    # What this specific purchase received. Snapshotted for the same reason
    # name/event_count already are: the promo row stays editable afterwards.
    op.add_column('member_packages', sa.Column('promo_code_id', sa.Integer(), sa.ForeignKey('promo_codes.id', ondelete='SET NULL'), nullable=True))
    op.add_column('member_packages', sa.Column('promo_code', sa.String(32), nullable=True))
    op.add_column('member_packages', sa.Column('discount_amount', sa.Numeric(12, 2), nullable=False, server_default='0'))
    op.add_column('member_packages', sa.Column('bonus_credits', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    op.drop_column('member_packages', 'bonus_credits')
    op.drop_column('member_packages', 'discount_amount')
    op.drop_column('member_packages', 'promo_code')
    op.drop_column('member_packages', 'promo_code_id')
    op.drop_index('ix_promo_redemptions_user_id', table_name='promo_redemptions')
    op.drop_index('ix_promo_redemptions_promo_code_id', table_name='promo_redemptions')
    op.drop_table('promo_redemptions')
    op.drop_index('ix_promo_codes_code', table_name='promo_codes')
    op.drop_table('promo_codes')
