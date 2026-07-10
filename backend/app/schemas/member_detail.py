from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class MemberRsvpOut(BaseModel):
    id: int
    event_id: int
    event_title: str
    event_date: datetime
    checked_in: bool
    created_at: datetime


class MemberUnlockedContentOut(BaseModel):
    id: int
    content_id: int
    title: str
    type: str
    unlocked_at: datetime


class MemberPaymentOut(BaseModel):
    id: int
    order_id: Optional[int]
    amount: Decimal
    currency: str
    status: str
    response_message: Optional[str]
    card_number: Optional[str]
    created_at: Optional[datetime]


class MemberGiftGivenOut(BaseModel):
    id: int
    recipient_name: str
    recipient_email: str
    gift_type: str
    duration_months: Optional[int]
    amount: Decimal
    status: str
    created_at: Optional[datetime]


class MemberGiftReceivedOut(BaseModel):
    id: int
    giver_name: str
    giver_email: str
    gift_type: str
    duration_months: Optional[int]
    redeemed_at: Optional[datetime]
    created_at: Optional[datetime]


class MemberGuestTicketMatchOut(BaseModel):
    """Best-effort match by email — GuestTicket has no user_id FK by design."""
    id: int
    event_id: int
    event_title: str
    amount: Decimal
    status: str
    checked_in: bool
    created_at: Optional[datetime]


class MemberReferralOut(BaseModel):
    id: int
    full_name: str
    email: Optional[str]
    membership_status: str
    joined_at: Optional[datetime]


class MemberAuditLogOut(BaseModel):
    id: int
    admin_id: Optional[int]
    admin_name: Optional[str]
    action: str
    details: Optional[str]
    created_at: Optional[datetime]


class ProfilePhotoOut(BaseModel):
    id: int
    url: str


class MemberDetailOut(BaseModel):
    # Identity & contact
    id: int
    email: Optional[str]
    full_name: str
    photo_url: Optional[str]
    lang_pref: Optional[str]
    phone: Optional[str]
    whatsapp: Optional[str]
    facebook_url: Optional[str]
    telegram_username: Optional[str]
    telegram_id: Optional[int]
    google_id: Optional[str]
    bio: Optional[str]
    admin_notes: Optional[str]
    is_verified: bool
    show_in_directory: bool
    application_status: str
    application_message: Optional[str]
    onboarding_completed: bool
    joined_at: Optional[datetime]
    updated_at: Optional[datetime]

    # Role / access
    is_admin: bool
    role: str
    permissions: Optional[str]

    # Membership & billing
    membership_status: str
    membership_expires_at: Optional[datetime]
    card_holder_id: Optional[str]
    binding_active: bool
    next_billing_date: Optional[datetime]
    renewal_attempts: int
    card_required_by: Optional[datetime]

    # Referrals
    referral_code: Optional[str]
    referred_by_id: Optional[int]
    referred_by_name: Optional[str] = None
    referred_by_email: Optional[str] = None
    referrals: List[MemberReferralOut] = []

    # Activity
    profile_photos: List[ProfilePhotoOut] = []
    rsvps: List[MemberRsvpOut] = []
    unlocked_content: List[MemberUnlockedContentOut] = []

    # Payments
    payments: List[MemberPaymentOut] = []

    # Gift cards
    gift_cards_given: List[MemberGiftGivenOut] = []
    gift_cards_received: List[MemberGiftReceivedOut] = []

    # Guest tickets (email-based match, clearly labeled in UI)
    guest_tickets_by_email: List[MemberGuestTicketMatchOut] = []

    # Audit log
    audit_log: List[MemberAuditLogOut] = []
