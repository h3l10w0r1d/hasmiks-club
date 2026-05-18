import secrets
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    title_hy = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    description_hy = Column(Text, nullable=True)
    location = Column(String, nullable=False)
    event_date = Column(DateTime(timezone=True), nullable=False)
    max_seats = Column(Integer, default=20)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    checkin_token = Column(String(32), nullable=True, unique=True, index=True)

    rsvps = relationship("RSVP", back_populates="event", cascade="all, delete-orphan")
