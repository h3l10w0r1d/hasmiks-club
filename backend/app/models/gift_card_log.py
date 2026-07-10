from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class GiftCardLog(Base):
    """Same purpose as AmeriaPaymentLog/GuestTicketLog — one Ameriabank API
    interaction per row — kept as its own table since gift_cards.id is an
    independent sequence from ameria_payments/guest_tickets."""
    __tablename__ = "gift_card_logs"

    id = Column(Integer, primary_key=True, index=True)
    gift_card_id = Column(Integer, ForeignKey("gift_cards.id"), nullable=False, index=True)
    event = Column(String(40), nullable=False)  # init_payment | verify_callback
    success = Column(Boolean, nullable=False, default=False)
    request_payload = Column(Text, nullable=True)
    response_payload = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
