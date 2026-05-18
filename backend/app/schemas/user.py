from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    lang_pref: str = "en"
    bio: Optional[str] = None
    referral_code: Optional[str] = None   # ref code of the inviter
    application_message: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    photo_url: Optional[str] = None
    lang_pref: Optional[str] = None
    show_in_directory: Optional[bool] = None
    bio: Optional[str] = None
    onboarding_completed: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    photo_url: Optional[str]
    lang_pref: str
    membership_status: str
    is_admin: bool = False
    is_verified: bool = False
    show_in_directory: bool = True
    admin_notes: Optional[str] = None
    bio: Optional[str] = None
    referral_code: Optional[str] = None
    referred_by_id: Optional[int] = None
    application_status: str = "approved"
    onboarding_completed: bool = False
    joined_at: datetime
    role: str = 'member'
    permissions: Optional[str] = None

    model_config = {"from_attributes": True}


class AdminUserUpdate(BaseModel):
    membership_status: Optional[str] = None
    is_admin: Optional[bool] = None
    full_name: Optional[str] = None
    admin_notes: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[str] = None  # JSON string or None to reset to role defaults


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class MemberDirectoryOut(BaseModel):
    id: int
    full_name: str
    photo_url: Optional[str]
    bio: Optional[str] = None
    joined_at: datetime
    referral_code: Optional[str] = None

    model_config = {"from_attributes": True}
