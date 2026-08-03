from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class MemberPackageLog(Base):
    """Same purpose as AmeriaPaymentLog/GuestTicketLog/GiftCardLog — one
    Ameriabank API interaction per row — kept as its own table since
    member_packages.id is an independent sequence."""
    __tablename__ = "member_package_logs"

    id = Column(Integer, primary_key=True, index=True)
    member_package_id = Column(Integer, ForeignKey("member_packages.id"), nullable=False, index=True)
    event = Column(String(40), nullable=False)  # init_payment | make_binding_payment | verify_callback
    success = Column(Boolean, nullable=False, default=False)
    request_payload = Column(Text, nullable=True)
    response_payload = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
