from sqlalchemy import Column, Integer, String, Numeric, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.sql import func
from app.database import Base


class PromoCode(Base):
    """An admin-created discount code a member can apply when buying a credit
    package.

    The three benefit fields are independent and stack, so one code can be a
    plain discount, a pure bonus-credit giveaway, or both at once:

      percent_off    20    -> 20% off the package price
      amount_off     5000  -> flat 5,000 off the price
      bonus_credits  2     -> 2 extra event credits on top of event_count

    percent_off and amount_off are mutually exclusive (validated in the admin
    router) so the final price is never ambiguous. percent_off = 100 is how a
    fully free package is expressed.

    Every limit is optional; NULL/0 means "no limit on this axis":
      starts_at / expires_at  the window the code is usable in
      max_uses                total redemptions across all members
      max_uses_per_user       redemptions allowed per member
      package_keys            comma-separated packages_config ids it applies
                              to; empty/NULL = every package
    """
    __tablename__ = "promo_codes"

    id = Column(Integer, primary_key=True, index=True)
    # Stored upper-cased; lookups upper-case the input so entry is case-insensitive.
    code = Column(String(32), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)  # internal admin note, never shown to members

    percent_off = Column(Integer, nullable=True)
    amount_off = Column(Numeric(12, 2), nullable=True)
    bonus_credits = Column(Integer, nullable=False, default=0, server_default='0')

    starts_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    max_uses = Column(Integer, nullable=True)
    max_uses_per_user = Column(Integer, nullable=True)
    package_keys = Column(Text, nullable=True)

    # Denormalised counter so the common "is this still available" check is a
    # single row read; the authoritative history is promo_redemptions.
    times_used = Column(Integer, nullable=False, default=0, server_default='0')
    active = Column(Boolean, nullable=False, default=True, server_default='true')

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class PromoRedemption(Base):
    """One successful use of a promo code, written only once the purchase it
    belongs to is actually paid — so an abandoned checkout never burns a use.
    Records what the code was worth at redemption time rather than recomputing
    from the (editable) PromoCode row later.
    """
    __tablename__ = "promo_redemptions"

    id = Column(Integer, primary_key=True, index=True)
    promo_code_id = Column(Integer, ForeignKey("promo_codes.id", ondelete="CASCADE"), nullable=False, index=True)
    # Nullable because gifts are bought by a giver who may have no account —
    # such a row identifies itself by gift_card_id + email instead.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    member_package_id = Column(Integer, ForeignKey("member_packages.id", ondelete="SET NULL"), nullable=True)
    gift_card_id = Column(Integer, ForeignKey("gift_cards.id", ondelete="SET NULL"), nullable=True)
    # The redeemer's email — what the per-person limit is enforced against
    # when there's no user_id to count.
    email = Column(String, nullable=True, index=True)

    discount_amount = Column(Numeric(12, 2), nullable=False, default=0)
    bonus_credits = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
