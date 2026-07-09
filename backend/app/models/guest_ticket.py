from sqlalchemy import Column, Integer, String, Numeric, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class GuestTicket(Base):
    """A one-time paid ticket for a single event, bought by someone without a
    member account. Mirrors AmeriaPayment's payment-tracking fields but is
    kept as its own table rather than reusing AmeriaPayment/User — a guest
    never gets membership_status, a password, or a directory entry, and
    existing membership-payment code (admin Payments tab, analytics) assumes
    every AmeriaPayment row has a real member behind it.

    status values: started | error | approved | deposited | declined | refunded | void
    (same vocabulary as AmeriaPayment, see ameriabank.status_from_details)
    """
    __tablename__ = "guest_tickets"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False, index=True)
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
    checked_in = Column(Boolean, nullable=False, default=False, server_default='false')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    event = relationship("Event", back_populates="guest_tickets")
