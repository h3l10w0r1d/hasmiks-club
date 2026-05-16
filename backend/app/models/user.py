from sqlalchemy import Column, Integer, String, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class MembershipStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    cancelled = "cancelled"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    photo_url = Column(String, nullable=True)
    lang_pref = Column(String, default="en")
    membership_status = Column(String, default=MembershipStatus.inactive)
    stripe_customer_id = Column(String, nullable=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    rsvps = relationship("RSVP", back_populates="user", cascade="all, delete-orphan")
    unlocked_content = relationship("MemberContent", back_populates="user", cascade="all, delete-orphan")
