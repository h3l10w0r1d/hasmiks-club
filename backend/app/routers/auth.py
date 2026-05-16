import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.password_reset import PasswordResetToken
from app.schemas.user import UserRegister, UserOut, TokenOut
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import settings
from app.core.deps import get_current_user
from app.core import email as mailer

router = APIRouter(prefix="/auth", tags=["auth"])


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


def _ensure_admin(user: User, db: Session) -> None:
    if settings.ADMIN_EMAIL and user.email.lower() == settings.ADMIN_EMAIL.lower():
        if not user.is_admin:
            user.is_admin = True
            db.commit()
            db.refresh(user)


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        lang_pref=payload.lang_pref,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _ensure_admin(user, db)
    mailer.send_welcome(user.email, user.full_name)
    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    _ensure_admin(user, db)
    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=TokenOut)
def refresh_token(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Issue a fresh token for any currently authenticated user."""
    token = create_access_token(str(current_user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(current_user))


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    # Always return 202 to avoid email enumeration
    if not user:
        return {"detail": "If that email exists, a reset link was sent"}

    # Invalidate old tokens
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,
    ).update({"used": True})
    db.commit()

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    prt = PasswordResetToken(user_id=user.id, token=token, expires_at=expires)
    db.add(prt)
    db.commit()

    reset_url = f"https://hasmiks-club.vercel.app/reset-password?token={token}"
    mailer.send_password_reset(user.email, user.full_name, reset_url)
    return {"detail": "If that email exists, a reset link was sent"}


@router.post("/reset-password", response_model=TokenOut)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    prt = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == payload.token,
        PasswordResetToken.used == False,
    ).first()
    if not prt:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if prt.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")

    user = db.query(User).filter(User.id == prt.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(payload.new_password)
    prt.used = True
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(user))
