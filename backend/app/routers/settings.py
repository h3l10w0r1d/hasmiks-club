from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.models.app_setting import AppSetting

router = APIRouter(prefix="/settings", tags=["settings"])


def _db_setting(db: Session, key: str, fallback: str = "") -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row and row.value else fallback


@router.get("/public")
def public_settings(db: Session = Depends(get_db)):
    """Non-sensitive public config the frontend needs."""
    return {
        "telegram_invite_url": _db_setting(db, "telegram_invite_url", settings.TELEGRAM_INVITE_URL),
        "ameriabank_enabled": bool(settings.AMERIABANK_CLIENT_ID and settings.AMERIABANK_USERNAME and settings.AMERIABANK_PASSWORD),
        "require_approval": _db_setting(db, "require_approval", "false").lower() == "true",
        "membership_price_display": _db_setting(db, "membership_price_display", ""),
        "club_description": _db_setting(db, "club_description", ""),
        "club_instagram": _db_setting(db, "club_instagram", ""),
        "club_location": _db_setting(db, "club_location", ""),
        "club_email": _db_setting(db, "club_email", ""),
        "club_phone": _db_setting(db, "club_phone", ""),
    }
