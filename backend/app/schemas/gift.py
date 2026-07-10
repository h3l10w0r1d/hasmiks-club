from decimal import Decimal
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class GiftEventSelection(BaseModel):
    event_id: int
    quantity: int = 1


class GiftStartIn(BaseModel):
    giver_name: str
    giver_email: str
    giver_phone: Optional[str] = None
    recipient_name: str
    recipient_email: str
    recipient_phone: Optional[str] = None
    anonymous: bool = False
    gift_type: str  # membership | events
    duration_months: Optional[int] = None  # required when gift_type == membership
    event_selections: Optional[List[GiftEventSelection]] = None  # required when gift_type == events
    lang_pref: Optional[str] = "en"


class GiftVerifyIn(BaseModel):
    code: str


class GiftCheckoutIn(BaseModel):
    lang_pref: Optional[str] = "en"


class GiftStartOut(BaseModel):
    gift_id: int
    resend_available_in: int


class GiftInfoOut(BaseModel):
    recipient_name: str
    giver_name: Optional[str] = None  # omitted when the gift was sent anonymously
    gift_type: str
    duration_months: Optional[int] = None
    already_redeemed: bool
    recipient_has_account: bool


class GiftClaimPasswordIn(BaseModel):
    password: str


class GiftCardOut(BaseModel):
    id: int
    giver_name: str
    giver_email: str
    giver_phone: Optional[str] = None
    recipient_name: str
    recipient_email: str
    recipient_phone: Optional[str] = None
    anonymous: bool
    gift_type: str
    duration_months: Optional[int] = None
    amount: Decimal
    status: str
    email_verified: bool
    redeemed: bool
    redeemed_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
