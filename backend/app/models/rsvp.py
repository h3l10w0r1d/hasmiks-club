from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class RSVP(Base):
    __tablename__ = "rsvps"
    __table_args__ = (UniqueConstraint("user_id", "event_id", name="uq_user_event"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    checked_in  = Column(Boolean, nullable=False, default=False, server_default='false')
    # Which credit-pack this RSVP spent a credit from (see MemberPackage) —
    # NULL for RSVPs made before packages existed. Lets cancel_rsvp() refund
    # the credit onto the exact package it came from.
    member_package_id = Column(Integer, ForeignKey("member_packages.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", back_populates="rsvps")
    event = relationship("Event", back_populates="rsvps")
