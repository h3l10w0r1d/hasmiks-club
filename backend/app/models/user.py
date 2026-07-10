from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Boolean, Text, ForeignKey
import sqlalchemy as sa
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class MembershipStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    cancelled = "cancelled"
    past_due = "past_due"  # a renewal charge (or the one-time card-migration deadline)
    # failed — treated identically to inactive for access control (not "active", so RSVP
    # etc. are blocked exactly like a guest); the distinct value only exists so the dunning
    # job and member-facing copy can say "your payment failed" instead of "never subscribed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)  # null for Telegram-only accounts
    password_hash = Column(String, nullable=True)  # null for Google/Telegram-only accounts
    google_id = Column(String(64), unique=True, index=True, nullable=True)  # Google's "sub" claim
    telegram_id = Column(BigInteger, unique=True, index=True, nullable=True)  # Telegram's numeric user id
    full_name = Column(String, nullable=False)
    photo_url = Column(String, nullable=True)
    lang_pref = Column(String, default="en")
    membership_status = Column(String, default=MembershipStatus.inactive)
    # Set only for gift-card-granted memberships (see GiftCard) — a scheduled
    # job lapses membership_status back to inactive once this passes. Regular
    # paying members never have this set (cleared if they ever start a real
    # subscription, see payments.py's payment_callback).
    membership_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Recurring membership billing (Ameriabank vPOS "binding" transactions —
    # see app/core/ameriabank.py). A member's first successful payment
    # registers a binding under card_holder_id; every subsequent renewal
    # charges that saved card directly with no re-entry of card details.
    card_holder_id = Column(String(64), unique=True, nullable=True)
    binding_active = Column(Boolean, nullable=False, default=False, server_default='false')
    next_billing_date = Column(DateTime(timezone=True), nullable=True)
    renewal_attempts = Column(Integer, nullable=False, default=0, server_default='0')
    # Set once, at migration time, only for members who were already active
    # with no card on file — gives them a window to add one before the same
    # past_due/lapse rules that apply to a real failed renewal start applying
    # to them too. Cleared the moment a card is actually added.
    card_required_by = Column(DateTime(timezone=True), nullable=True)

    is_admin = Column(Boolean, default=False, nullable=False, server_default='false')
    role = Column(String(20), nullable=False, default='member', server_default='member')
    permissions = Column(Text, nullable=True)  # JSON list of strings, overrides role defaults if set
    is_verified = Column(Boolean, default=False, nullable=False, server_default='false')
    show_in_directory = Column(Boolean, default=True, nullable=False, server_default='true')
    verification_token = Column(String, nullable=True)
    verification_token_expires = Column(sa.DateTime(timezone=True), nullable=True)
    admin_notes = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    facebook_url = Column(String, nullable=True)
    telegram_username = Column(String(64), nullable=True)
    phone = Column(String(32), nullable=True)
    whatsapp = Column(String(32), nullable=True)
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
    profile_photos = relationship("ProfilePhoto", back_populates="user", cascade="all, delete-orphan",
                                  order_by="ProfilePhoto.sort_order")


class ProfilePhoto(Base):
    """A small personal photo-gallery entry on a member's profile (capped at 6)."""
    __tablename__ = "profile_photos"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    url        = Column(Text, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="profile_photos")
