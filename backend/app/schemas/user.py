from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    lang_pref: str = "en"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    photo_url: Optional[str] = None
    lang_pref: Optional[str] = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    photo_url: Optional[str]
    lang_pref: str
    membership_status: str
    is_admin: bool = False
    joined_at: datetime

    model_config = {"from_attributes": True}


class AdminUserUpdate(BaseModel):
    membership_status: Optional[str] = None
    is_admin: Optional[bool] = None
    full_name: Optional[str] = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
