from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class AmeriaPayment(Base):
    """One membership checkout attempt via Ameriabank vPOS.

    status values: started | error | approved | deposited | declined | refunded | void
    """
    __tablename__ = "ameria_payments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, unique=True, index=True, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    payment_id = Column(String, nullable=True, index=True)  # returned by InitPayment
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="051")
    status = Column(String(20), nullable=False, default="started")
    response_code = Column(String(20), nullable=True)
    response_message = Column(String(255), nullable=True)
    card_number = Column(String(20), nullable=True)
    approval_code = Column(String(20), nullable=True)
    rrn = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
