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

    user = relationship("User", back_populates="rsvps")
    event = relationship("Event", back_populates="rsvps")
