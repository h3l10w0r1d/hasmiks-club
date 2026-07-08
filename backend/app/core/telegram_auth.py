"""
Shared Telegram Login Widget verification — used both by /auth/telegram
(sign in / create an account) and /members/me/telegram (link Telegram to
an already-logged-in account). Kept in one place so both call sites stay
in sync on the verification algorithm.
"""
import hashlib
import hmac
from datetime import datetime, timezone

from fastapi import HTTPException
from pydantic import BaseModel

from app.core.config import settings


class TelegramSignInRequest(BaseModel):
    id: int
    first_name: str
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str
    referral_code: str | None = None  # only used when this creates a brand-new account


def verify_telegram_payload(payload: TelegramSignInRequest) -> None:
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
