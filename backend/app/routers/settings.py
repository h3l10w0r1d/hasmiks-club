from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.database import get_db
from app.models.app_setting import AppSetting
from app.models.user import User

router = APIRouter(prefix="/settings", tags=["settings"])


def _db_setting(db: Session, key: str, fallback: str = "") -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row and row.value else fallback


@router.get("/public")
def public_settings(db: Session = Depends(get_db)):
    """Non-sensitive public config the frontend needs. The private Telegram
    group invite is deliberately NOT here — it's members-only, see
    /settings/member below."""
    monthly = settings.AMERIABANK_MEMBERSHIP_AMOUNT
    return {
        "ameriabank_enabled": bool(settings.AMERIABANK_CLIENT_ID and settings.AMERIABANK_USERNAME and settings.AMERIABANK_PASSWORD),
        "require_approval": _db_setting(db, "require_approval", "false").lower() == "true",
        "membership_price_display": _db_setting(db, "membership_price_display", ""),
        "club_description": _db_setting(db, "club_description", ""),
        "club_instagram": _db_setting(db, "club_instagram", ""),
        "club_location": _db_setting(db, "club_location", ""),
        "club_email": _db_setting(db, "club_email", ""),
        "club_phone": _db_setting(db, "club_phone", ""),
        # Gift-membership price tiers — default to monthly rate × months
        # (no bundle discount) unless the admin has set an explicit override.
        "gift_prices": {
            "1": float(_db_setting(db, "gift_price_1m", "") or monthly * 1),
            "3": float(_db_setting(db, "gift_price_3m", "") or monthly * 3),
            "6": float(_db_setting(db, "gift_price_6m", "") or monthly * 6),
            "12": float(_db_setting(db, "gift_price_12m", "") or monthly * 12),
        },
    }


@router.get("/member")
def member_settings(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Settings gated to logged-in members with an active subscription — the
    private Telegram group invite lives here instead of /settings/public so
    it's never exposed to anonymous visitors or lapsed/inactive accounts."""
    telegram_invite_url = ""
    if current_user.membership_status == "active":
        telegram_invite_url = _db_setting(db, "telegram_invite_url", settings.TELEGRAM_INVITE_URL)
    return {"telegram_invite_url": telegram_invite_url}
