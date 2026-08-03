from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class MemberPackage(Base):
    """One credit-pack purchase (or gift delivery) — replaces the recurring
    membership subscription. A member buys a package once for a flat price
    and gets `event_count` RSVP credits, optionally expiring after
    `validity_days`. Name/event_count/validity_days are snapshotted from the
    admin-configured `packages_config` AppSetting at purchase time, so an
    admin editing or deleting that config entry later never affects credits
    already issued.

    Doubles as the payment-tracking row (same shape as AmeriaPayment/
    GuestTicket/GiftCard) and the credit ledger — `credits_remaining` is
    decremented by events.py's RSVP flow and incremented back on cancel.

    status values: started | error | approved | deposited | declined |
    refunded | void | autoauthorized (same vocabulary as
    ameriabank.status_from_details) — only deposited/autoauthorized rows
    ever carry usable credits.
    """
    __tablename__ = "member_packages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Snapshot of the packages_config entry at purchase time — package_key
    # is the config's client-generated "id", kept for reference only (the
    # config it points at may later change or be deleted).
    package_key = Column(String(64), nullable=True)
    name_en = Column(String, nullable=False)
    name_hy = Column(String, nullable=False)
    event_count = Column(Integer, nullable=False)
    credits_remaining = Column(Integer, nullable=False, default=0)
    validity_days = Column(Integer, nullable=True)  # NULL = never expires
    expires_at = Column(DateTime(timezone=True), nullable=True)  # NULL = never expires

    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="051")
    order_id = Column(Integer, unique=True, index=True, nullable=True)
    payment_id = Column(String, nullable=True, index=True)
    status = Column(String(20), nullable=False, default="started")
    response_code = Column(String(20), nullable=True)
    response_message = Column(String(255), nullable=True)
    card_number = Column(String(20), nullable=True)
    approval_code = Column(String(20), nullable=True)
    rrn = Column(String(64), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
