import hashlib
import hmac
import secrets
import string
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.password_reset import PasswordResetToken
from app.models.app_setting import AppSetting
from app.schemas.user import UserRegister, UserOut, TokenOut
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import settings
from app.core.deps import get_current_user
from app.core import email as mailer

router = APIRouter(prefix="/auth", tags=["auth"])


class GoogleSignInRequest(BaseModel):
    credential: str  # the ID token from Google Identity Services
    referral_code: str | None = None  # only used when this creates a brand-new account


class TelegramSignInRequest(BaseModel):
    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str
    referral_code: str | None = None  # only used when this creates a brand-new account

_REF_CHARS = string.ascii_uppercase + string.digits


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


def _ensure_admin(user: User, db: Session) -> None:
    if settings.ADMIN_EMAIL and user.email and user.email.lower() == settings.ADMIN_EMAIL.lower():
        if not user.is_admin:
            user.is_admin = True
            db.commit()
            db.refresh(user)


def _get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row and row.value is not None else default


def _gen_referral_code(db: Session) -> str:
    for _ in range(10):
        code = "".join(secrets.choice(_REF_CHARS) for _ in range(8))
        if not db.query(User).filter(User.referral_code == code).first():
            return code
    return secrets.token_hex(4).upper()


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    require_approval = _get_setting(db, "require_approval", "false").lower() == "true"
    app_status = "pending" if require_approval else "approved"

    # Resolve referral code → referred_by_id
    referred_by_id = None
    if payload.referral_code:
        referrer = db.query(User).filter(User.referral_code == payload.referral_code.upper()).first()
        if referrer:
            referred_by_id = referrer.id

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        lang_pref=payload.lang_pref,
        bio=payload.bio,
        is_verified=False,
        application_message=payload.application_message,
        application_status=app_status,
        referred_by_id=referred_by_id,
        referral_code=_gen_referral_code(db),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _ensure_admin(user, db)

    # Send verification email
    vtoken = secrets.token_urlsafe(32)
    user.verification_token = vtoken
    user.verification_token_expires = datetime.now(timezone.utc) + timedelta(hours=24)
    db.commit()
    verify_url = f"{settings.API_BASE_URL}/auth/verify-email?token={vtoken}"
    mailer.send_verification(user.email, user.full_name, verify_url)

    if app_status == "pending":
        mailer.send_application_received(user.email, user.full_name)
    else:
        mailer.send_welcome(user.email, user.full_name)
    mailer.sync_contact_async(user.email, user.full_name, user.membership_status)

    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    _ensure_admin(user, db)
    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/google", response_model=TokenOut)
def google_sign_in(payload: GoogleSignInRequest, db: Session = Depends(get_db)):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google Sign-In is not configured")
    try:
        claims = google_id_token.verify_oauth2_token(
            payload.credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    if not claims.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google account email is not verified")

    google_sub = claims["sub"]
    email = claims["email"].lower()
    full_name = claims.get("name") or email.split("@")[0]

    user = db.query(User).filter(User.google_id == google_sub).first()
    is_new = False

    if not user:
        # Auto-link: same email already registered (e.g. via email/password) → attach this Google account.
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.google_id = google_sub
            if not user.is_verified:
                user.is_verified = True  # Google already verified this address
            db.commit()
            db.refresh(user)
        else:
            is_new = True
            require_approval = _get_setting(db, "require_approval", "false").lower() == "true"
            app_status = "pending" if require_approval else "approved"

            referred_by_id = None
            if payload.referral_code:
                referrer = db.query(User).filter(User.referral_code == payload.referral_code.upper()).first()
                if referrer:
                    referred_by_id = referrer.id

            user = User(
                email=email,
                password_hash=None,
                google_id=google_sub,
                full_name=full_name,
                is_verified=True,
                application_status=app_status,
                referred_by_id=referred_by_id,
                referral_code=_gen_referral_code(db),
            )
            db.add(user)
            db.commit()
            db.refresh(user)

    _ensure_admin(user, db)

    if is_new:
        if user.application_status == "pending":
            mailer.send_application_received(user.email, user.full_name)
        else:
            mailer.send_welcome(user.email, user.full_name)
        mailer.sync_contact_async(user.email, user.full_name, user.membership_status)

    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


def _verify_telegram_payload(payload: TelegramSignInRequest) -> None:
    """Verify Telegram's login-widget HMAC per their documented algorithm, and
    reject stale payloads (a captured/replayed widget response)."""
    data = payload.model_dump(exclude={"hash", "referral_code"}, exclude_none=True)
    check_string = "\n".join(f"{k}={data[k]}" for k in sorted(data))
    secret_key = hashlib.sha256(settings.TELEGRAM_BOT_TOKEN.encode()).digest()
    computed = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(computed, payload.hash):
        raise HTTPException(status_code=401, detail="Invalid Telegram credential")
    if datetime.now(timezone.utc).timestamp() - payload.auth_date > 86400:
        raise HTTPException(status_code=401, detail="Telegram login expired — please try again")


@router.post("/telegram", response_model=TokenOut)
def telegram_sign_in(payload: TelegramSignInRequest, db: Session = Depends(get_db)):
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram Sign-In is not configured")
    _verify_telegram_payload(payload)

    full_name = f"{payload.first_name} {payload.last_name}".strip() if payload.last_name else payload.first_name
    user = db.query(User).filter(User.telegram_id == payload.id).first()
    is_new = False

    if not user:
        # Telegram never provides an email, so there's nothing reliable to auto-link
        # against — every first-time Telegram sign-in is a brand-new account.
        is_new = True
        require_approval = _get_setting(db, "require_approval", "false").lower() == "true"
        app_status = "pending" if require_approval else "approved"

        referred_by_id = None
        if payload.referral_code:
            referrer = db.query(User).filter(User.referral_code == payload.referral_code.upper()).first()
            if referrer:
                referred_by_id = referrer.id

        user = User(
            email=None,
            password_hash=None,
            telegram_id=payload.id,
            telegram_username=payload.username,
            full_name=full_name,
            photo_url=payload.photo_url,
            is_verified=True,  # Telegram already confirmed control of this account
            application_status=app_status,
            referred_by_id=referred_by_id,
            referral_code=_gen_referral_code(db),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Keep the verified handle current on every login (distinct from the
        # free-text telegram_username a member can otherwise type into their profile).
        if payload.username and user.telegram_username != payload.username:
            user.telegram_username = payload.username
            db.commit()
            db.refresh(user)

    _ensure_admin(user, db)

    if is_new:
        # No email to send a welcome/application-received notice to — sync_contact_async
        # and send_* already no-op safely when email is None, so nothing further needed.
        mailer.sync_contact_async(user.email, user.full_name, user.membership_status)

    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/refresh", response_model=TokenOut)
def refresh_token(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    token = create_access_token(str(current_user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(current_user))


@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.verification_token == token).first()
    if not user:
        return RedirectResponse("https://www.hasmiksclub.am/dashboard?verified=invalid")
    expires = user.verification_token_expires
    if expires and expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return RedirectResponse("https://www.hasmiksclub.am/dashboard?verified=expired")
    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()
    return RedirectResponse("https://www.hasmiksclub.am/dashboard?verified=ok")


@router.post("/resend-verification", status_code=status.HTTP_202_ACCEPTED)
def resend_verification(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.is_verified:
        return {"detail": "Already verified"}
    vtoken = secrets.token_urlsafe(32)
    current_user.verification_token = vtoken
    current_user.verification_token_expires = datetime.now(timezone.utc) + timedelta(hours=24)
    db.commit()
    verify_url = f"{settings.API_BASE_URL}/auth/verify-email?token={vtoken}"
    mailer.send_verification(current_user.email, current_user.full_name, verify_url)
    return {"detail": "Verification email sent"}


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user:
        return {"detail": "If that email exists, a reset link was sent"}
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,
    ).update({"used": True})
    db.commit()
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    db.add(PasswordResetToken(user_id=user.id, token=token, expires_at=expires))
    db.commit()
    reset_url = f"https://www.hasmiksclub.am/reset-password?token={token}"
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
