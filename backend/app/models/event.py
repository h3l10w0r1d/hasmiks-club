import secrets
from sqlalchemy import Column, Integer, String, DateTime, Text, Numeric
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
    # Optional Yandex Maps (or any map provider) link — a plain convenience
    # link, not geocoded/validated, shown as "View on map" next to location.
    map_url = Column(String, nullable=True)
    event_date = Column(DateTime(timezone=True), nullable=False)
    max_seats = Column(Integer, default=20)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    cover_url = Column(String, nullable=True)
    checkin_token = Column(String(32), nullable=True, unique=True, index=True)
    # Non-members can buy a one-time ticket when this is set; null means the
    # event stays members-only RSVP, matching pre-existing behavior.
    ticket_price = Column(Numeric(12, 2), nullable=True)
    # Optional cap on how many of max_seats can go to one-time guest tickets,
    # effectively reserving the rest for members. Null = guests and members
    # share the full max_seats pool with no reservation.
    max_guest_tickets = Column(Integer, nullable=True)

    rsvps = relationship("RSVP", back_populates="event", cascade="all, delete-orphan")
    guest_tickets = relationship("GuestTicket", back_populates="event", cascade="all, delete-orphan")
