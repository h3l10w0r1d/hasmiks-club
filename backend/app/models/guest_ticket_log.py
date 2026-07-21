from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class GuestTicketLog(Base):
    """Same purpose as AmeriaPaymentLog, but for one-time guest tickets — kept
    as a separate table rather than sharing ameria_payment_logs since that
    table's FK points at ameria_payments specifically, and guest_tickets is a
    deliberately independent table with its own id sequence."""
    __tablename__ = "guest_ticket_logs"

    id = Column(Integer, primary_key=True, index=True)
    ticket_row_id = Column(Integer, ForeignKey("guest_tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    event = Column(String(40), nullable=False)  # init_payment | verify_callback
    success = Column(Boolean, nullable=False, default=False)
    request_payload = Column(Text, nullable=True)
    response_payload = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
