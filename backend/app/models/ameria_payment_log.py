from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class AmeriaPaymentLog(Base):
    """One entry per Ameriabank API call made for a given payment — lets an
    admin see exactly what was sent/received at each step (InitPayment, the
    BackURL verification call, and any manual refresh/refund/cancel), instead
    of only the payment's current, overwritten state."""
    __tablename__ = "ameria_payment_logs"

    id = Column(Integer, primary_key=True, index=True)
    payment_row_id = Column(Integer, ForeignKey("ameria_payments.id"), nullable=False, index=True)
    event = Column(String(40), nullable=False)  # init_payment | verify_callback | admin_refresh | admin_refund | admin_cancel
    success = Column(Boolean, nullable=False, default=False)
    request_payload = Column(Text, nullable=True)   # JSON string — never includes credentials
    response_payload = Column(Text, nullable=True)  # JSON string, or an error message on failure
    created_at = Column(DateTime(timezone=True), server_default=func.now())
