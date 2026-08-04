from decimal import Decimal
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class PackageOut(BaseModel):
    """One entry from the admin-configured packages_config list — public,
    used by the Pricing section and every purchase/gift picker."""
    id: str
    nameEn: str
    nameHy: str
    eventCount: int
    price: float
    regularPrice: Optional[float] = None
    descriptionEn: str = ""
    descriptionHy: str = ""
    validityDays: Optional[int] = None
    telegramAccess: bool = False
    badge: Optional[str] = None
    itemsEn: List[str] = []
    itemsHy: List[str] = []


class MemberPackageOut(BaseModel):
    id: int
    package_key: Optional[str] = None
    name_en: str
    name_hy: str
    event_count: int
    credits_remaining: int
    validity_days: Optional[int] = None
    expires_at: Optional[datetime] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MyPackagesOut(BaseModel):
    packages: List[MemberPackageOut]
    credits_available: int


class PackageCheckoutIn(BaseModel):
    package_key: str
    lang_pref: Optional[str] = "en"


class PackageCheckoutOut(BaseModel):
    mode: str  # "instant" | "redirect"
    url: Optional[str] = None
    success: Optional[bool] = None
    message: Optional[str] = None
