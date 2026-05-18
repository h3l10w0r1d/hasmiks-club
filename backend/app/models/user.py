from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
import sqlalchemy as sa
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
    is_admin = Column(Boolean, default=False, nullable=False, server_default='false')
    role = Column(String(20), nullable=False, default='member', server_default='member')
    permissions = Column(Text, nullable=True)  # JSON list of strings, overrides role defaults if set
    is_verified = Column(Boolean, default=False, nullable=False, server_default='false')
    show_in_directory = Column(Boolean, default=True, nullable=False, server_default='true')
    verification_token = Column(String, nullable=True)
    verification_token_expires = Column(sa.DateTime(timezone=True), nullable=True)
    admin_notes = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    referral_code = Column(String(16), nullable=True, unique=True, index=True)
    referred_by_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    application_message = Column(Text, nullable=True)
    application_status = Column(String(20), nullable=False, default='approved', server_default='approved')
    onboarding_completed = Column(Boolean, nullable=False, default=False, server_default='false')
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    rsvps = relationship("RSVP", back_populates="user", cascade="all, delete-orphan")
    unlocked_content = relationship("MemberContent", back_populates="user", cascade="all, delete-orphan")
    referrals = relationship("User", foreign_keys="User.referred_by_id", backref=sa.orm.backref("referred_by", remote_side="User.id"))
