"""allow promo codes on gift purchases

Revision ID: 0033
Revises: 0032
Create Date: 2026-08-22

Gifts are bought by a giver who may have no account (same anonymous-purchase
model as guest tickets), so a redemption can no longer assume a user_id.
user_id becomes nullable and the row instead records whichever identity it
has: a member, or a gift plus the giver's email — which is what the
per-person use limit is enforced against for anonymous givers.
"""
from alembic import op
import sqlalchemy as sa

revision = '0033'
down_revision = '0032'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('promo_redemptions', 'user_id', existing_type=sa.Integer(), nullable=True)
    op.add_column('promo_redemptions', sa.Column('gift_card_id', sa.Integer(), sa.ForeignKey('gift_cards.id', ondelete='SET NULL'), nullable=True))
    # Who redeemed it, when there's no account to point at.
    op.add_column('promo_redemptions', sa.Column('email', sa.String(), nullable=True))
    op.create_index('ix_promo_redemptions_email', 'promo_redemptions', ['email'])

    # Same snapshot columns member_packages carries, for the same reason: the
    # promo row stays editable, so what this gift got has to be recorded here.
    op.add_column('gift_cards', sa.Column('promo_code_id', sa.Integer(), sa.ForeignKey('promo_codes.id', ondelete='SET NULL'), nullable=True))
    op.add_column('gift_cards', sa.Column('promo_code', sa.String(32), nullable=True))
    op.add_column('gift_cards', sa.Column('discount_amount', sa.Numeric(12, 2), nullable=False, server_default='0'))
    op.add_column('gift_cards', sa.Column('bonus_credits', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    op.drop_column('gift_cards', 'bonus_credits')
    op.drop_column('gift_cards', 'discount_amount')
    op.drop_column('gift_cards', 'promo_code')
    op.drop_column('gift_cards', 'promo_code_id')
    op.drop_index('ix_promo_redemptions_email', table_name='promo_redemptions')
    op.drop_column('promo_redemptions', 'email')
    op.drop_column('promo_redemptions', 'gift_card_id')
    op.alter_column('promo_redemptions', 'user_id', existing_type=sa.Integer(), nullable=False)
