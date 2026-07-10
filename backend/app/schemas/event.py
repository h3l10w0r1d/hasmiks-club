from decimal import Decimal
from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class EventCreate(BaseModel):
    title: str
    title_hy: Optional[str] = None
    description: Optional[str] = None
    description_hy: Optional[str] = None
    location: str
    event_date: datetime
    max_seats: int = 20
    cover_url: Optional[str] = None
    ticket_price: Optional[Decimal] = None
    max_guest_tickets: Optional[int] = None


class EventOut(BaseModel):
    id: int
    title: str
    title_hy: Optional[str]
    description: Optional[str]
    description_hy: Optional[str]
    location: str
    event_date: datetime
    max_seats: int
    seats_taken: int
    seats_available: int
    user_has_rsvp: bool = False
    cover_url: Optional[str] = None
    ticket_price: Optional[Decimal] = None
    max_guest_tickets: Optional[int] = None
    guest_seats_taken: int = 0

    model_config = {"from_attributes": True}


class RSVPOut(BaseModel):
    id: int
    event_id: int
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PublicEventOut(BaseModel):
    id: int
    title: str
    title_hy: Optional[str]
    description: Optional[str]
    description_hy: Optional[str]
    location: str
    event_date: datetime
    max_seats: int
    seats_available: int
    is_full: bool
    cover_url: Optional[str] = None
    ticket_price: Optional[Decimal] = None
    guest_tickets_available: Optional[int] = None
    guest_tickets_full: bool = False

    model_config = {"from_attributes": True}


class GuestCheckoutIn(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    lang_pref: Optional[str] = "en"


class GuestVerifyIn(BaseModel):
    code: str


class MemberGuestTicketIn(BaseModel):
    lang_pref: Optional[str] = "en"


class GuestCheckoutStartOut(BaseModel):
    ticket_id: int
    resend_available_in: int  # seconds until a resend is allowed


class GuestTicketOut(BaseModel):
    id: int
    event_id: int
    event_title: Optional[str] = None
    full_name: str
    email: str
    phone: Optional[str] = None
    amount: Decimal
    status: str
    email_verified: bool = False
    checked_in: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class WaitlistOut(BaseModel):
    id: int
    event_id: int
    user_id: int
    position: int
    created_at: datetime

    model_config = {"from_attributes": True}
