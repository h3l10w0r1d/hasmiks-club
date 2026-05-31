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

    model_config = {"from_attributes": True}


class WaitlistOut(BaseModel):
    id: int
    event_id: int
    user_id: int
    position: int
    created_at: datetime

    model_config = {"from_attributes": True}
