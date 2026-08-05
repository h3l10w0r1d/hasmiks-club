import secrets
import string
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse
import requests as http_requests
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
from app.core.telegram_auth import TelegramSignInRequest, verify_telegram_payload
from app.core import email as mailer

router = APIRouter(prefix="/auth", tags=["auth"])


class GoogleSignInRequest(BaseModel):
    # An OAuth2 access token from Google's implicit token-client popup flow
    # (google.accounts.oauth2.initTokenClient) — NOT an ID token/JWT. Verified
    # by calling Google's userinfo endpoint, not by local JWT signature
    # verification. See the comment on the /google route for why this
    # replaced the old ID-token + renderButton()/One Tap approach.
    access_token: str
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


def _track_new_signup(db: Session, user: User, method: str, referrer: "User | None") -> None:
    """CRM side-effects shared by every signup path: sync the new contact,
    fire the account_registered / application_submitted events, and credit
    the referrer (if any) with a referral_signup event."""
    mailer.sync_member_to_brevo(db, user)
    mailer.track_event_async(user.email, "account_registered", {"method": method, "referred": referrer is not None})
    if user.application_status == "pending":
        mailer.track_event_async(user.email, "application_submitted")
    if referrer is not None:
        mailer.track_event_async(referrer.email, "referral_signup", {"referred_user_name": user.full_name})


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    require_approval = _get_setting(db, "require_approval", "false").lower() == "true"
    app_status = "pending" if require_approval else "approved"

    # Resolve referral code → referred_by_id
    referred_by_id = None
    referrer = None
    if payload.referral_code:
        referrer = db.query(User).filter(User.referral_code == payload.referral_code.upper()).first()
        if referrer:
            referred_by_id = referrer.id

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
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
    _track_new_signup(db, user, "email", referrer)

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
    # Was ID-token verification (google.oauth2.id_token.verify_oauth2_token)
    # fed by a Google-rendered button/One Tap prompt — dropped because both
    # renderButton() and prompt() turned out to reproducibly fail silently
    # in real usage (renderButton's injected iframe sizes itself to 0x0,
    # prompt() never even attempts a network request), most likely third-
    # party-cookie/FedCM restrictions increasingly the default across
    # browsers, which both of those flows depend on. The OAuth2 popup flow
    # (google.accounts.oauth2.initTokenClient on the frontend) opens a real
    # top-level popup instead, which doesn't depend on either — this route
    # now verifies the resulting access token by asking Google's own
    # userinfo endpoint who it belongs to, rather than checking a JWT
    # signature locally.
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google Sign-In is not configured")
    try:
        resp = http_requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {payload.access_token}"},
            timeout=10,
        )
        resp.raise_for_status()
        claims = resp.json()
    except http_requests.RequestException:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    # Google's userinfo endpoint has returned this as either a real bool or
    # the string "true" depending on version/library — check both rather
    # than trust Python truthiness (the string "false" is truthy).
    if claims.get("email_verified") not in (True, "true"):
        raise HTTPException(status_code=401, detail="Google account email is not verified")

    google_sub = claims["sub"]
    email = claims["email"].lower()
    full_name = claims.get("name") or email.split("@")[0]

    user = db.query(User).filter(User.google_id == google_sub).first()
    is_new = False
    referrer = None

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
        _track_new_signup(db, user, "google", referrer)

    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


def _telegram_login(payload: TelegramSignInRequest, db: Session) -> tuple[User, bool]:
    """Find-or-create the user for an already-HMAC-verified Telegram
    payload. Shared by both the POST (JS-callback widget) and GET
    (redirect widget) entry points below — they differ only in how the
    resulting token gets back to the frontend, not in this logic. Returns
    (user, is_new) — the redirect entry point forwards is_new to the
    frontend so it can show the post-registration package popup, mirroring
    what RegisterForm.jsx's markJustRegistered does for the other providers."""
    full_name = f"{payload.first_name} {payload.last_name}".strip() if payload.last_name else payload.first_name
    user = db.query(User).filter(User.telegram_id == payload.id).first()
    is_new = False
    referrer = None

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
        # No email to send a welcome/application-received notice to — the CRM
        # calls in _track_new_signup already no-op safely when email is None,
        # except the referral_signup event, which still fires to the referrer.
        _track_new_signup(db, user, "telegram", referrer)

    return user, is_new


@router.post("/telegram", response_model=TokenOut)
def telegram_sign_in(payload: TelegramSignInRequest, db: Session = Depends(get_db)):
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram Sign-In is not configured")
    verify_telegram_payload(payload)
    user, _is_new = _telegram_login(payload, db)
    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.get("/telegram/callback")
def telegram_callback(
    id: int,
    first_name: str,
    auth_date: int,
    hash: str,
    last_name: str | None = None,
    username: str | None = None,
    photo_url: str | None = None,
    referral_code: str | None = None,
    next: str | None = None,
    db: Session = Depends(get_db),
):
    """Telegram Login Widget's REDIRECT mode (data-auth-url, as opposed to
    the JS-callback data-onauth mode the POST /telegram route above still
    serves for other callers) — Telegram signs the user's data and sends
    the member's own browser here as a plain top-level GET, not a popup or
    an AJAX call. Swapped in as the primary flow after the JS-callback
    widget's invisible-iframe click target was found to reproducibly fail
    to open its popup at all (confirmed even clicking Telegram's own
    unmodified widget directly, outside our app entirely) — the same class
    of popup/FedCM-dependent failure GoogleSignInButton.jsx hit and fixed
    by switching away from a popup-opening flow. A plain redirect has no
    popup to block in the first place.

    `next` is an opaque frontend path (e.g. /dashboard, or
    /gift/claim/<token>?social=1) that TelegramLoginButton.jsx passed in as
    part of data-auth-url — Telegram preserves it since it only appends its
    own params, never removes existing ones. Forwarded straight through to
    TelegramAuthCompletePage.jsx so callers other than plain login/register
    (e.g. gift claiming, which needs an extra step after auth) still work.
    """
    complete_url = settings.TELEGRAM_LOGIN_COMPLETE_URL
    next_qs = f"&next={quote(next)}" if next else ""
    if not settings.TELEGRAM_BOT_TOKEN:
        return RedirectResponse(f"{complete_url}?error=unavailable{next_qs}")
    payload = TelegramSignInRequest(
        id=id, first_name=first_name, last_name=last_name, username=username,
        photo_url=photo_url, auth_date=auth_date, hash=hash, referral_code=referral_code,
    )
    try:
        verify_telegram_payload(payload)
    except HTTPException:
        return RedirectResponse(f"{complete_url}?error=invalid{next_qs}")
    user, is_new = _telegram_login(payload, db)
    token = create_access_token(str(user.id))
    # Matches RegisterForm.jsx's markJustRegistered condition exactly, so the
    # post-registration package popup shows regardless of which provider —
    # or which form (login vs register) — created the account.
    new_qs = "&new=1" if is_new and user.application_status != "pending" else ""
    return RedirectResponse(f"{complete_url}?token={token}{next_qs}{new_qs}")


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
