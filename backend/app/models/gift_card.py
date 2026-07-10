from sqlalchemy import Column, Integer, String, Numeric, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class GiftCard(Base):
    """A membership or one-time-event gift bought by one person (the giver,
    who may not have an account — same anonymous-purchase model as GuestTicket)
    for someone else (the recipient). Payment-tracking fields mirror
    AmeriaPayment/GuestTicket; the giver's own email is OTP-verified before
    checkout for the same reason guest tickets are — a typo'd email means a
    paid gift nobody can ever get a receipt for, and worse here, one the
    recipient might never receive either.

    gift_type == "membership": duration_months set, applied either
      immediately (recipient already has an account) or via a redemption
      link (brand-new recipient sets a password / signs in with Google or
      Telegram) — see redemption_token/redeemed/applied_to_user_id below.
    gift_type == "events": one or more GuestTicket rows are created at
      payment time (see GuestTicket.gift_card_id) and emailed directly to
      the recipient — no redemption step, delivery IS the redemption.

    status values: unverified | started | error | approved | deposited |
    declined | refunded | void (same vocabulary as GuestTicket/AmeriaPayment)
    """
    __tablename__ = "gift_cards"

    id = Column(Integer, primary_key=True, index=True)

    giver_name = Column(String, nullable=False)
    giver_email = Column(String, nullable=False, index=True)
    giver_phone = Column(String(32), nullable=True)

    recipient_name = Column(String, nullable=False)
    recipient_email = Column(String, nullable=False, index=True)
    recipient_phone = Column(String(32), nullable=True)

    anonymous = Column(Boolean, nullable=False, default=False, server_default='false')

    gift_type = Column(String(20), nullable=False)  # membership | events
    duration_months = Column(Integer, nullable=True)  # membership only: 1 | 3 | 6 | 12
    event_selections_json = Column(String, nullable=True)  # events only: JSON [{"event_id":1,"quantity":2}, ...]

    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="051")
    order_id = Column(Integer, unique=True, index=True, nullable=True)
    payment_id = Column(String, nullable=True, index=True)
    status = Column(String(20), nullable=False, default="unverified")
    response_code = Column(String(20), nullable=True)
    response_message = Column(String(255), nullable=True)
    card_number = Column(String(20), nullable=True)
    approval_code = Column(String(20), nullable=True)
    rrn = Column(String(64), nullable=True)

    # Giver email ownership check, same reasoning/shape as GuestTicket's.
    email_verified = Column(Boolean, nullable=False, default=False, server_default='false')
    verification_code = Column(String(6), nullable=True)
    verification_sent_at = Column(DateTime(timezone=True), nullable=True)
    verification_attempts = Column(Integer, nullable=False, default=0, server_default='0')

    # Membership-gift redemption. Null token = either an events-gift (no
    # redemption step) or a membership gift that was applied immediately
    # because the recipient already had an account.
    redemption_token = Column(String(43), nullable=True, unique=True, index=True)
    redeemed = Column(Boolean, nullable=False, default=False, server_default='false')
    redeemed_at = Column(DateTime(timezone=True), nullable=True)
    applied_to_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
