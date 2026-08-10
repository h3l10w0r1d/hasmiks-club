import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.database import get_db
from app.models.app_setting import AppSetting
from app.models.user import User
from app.routers.app_settings import get_packages_config

router = APIRouter(prefix="/settings", tags=["settings"])

# Landing-page copy the admin has overridden via the Site Editor. Stored as a
# single JSON blob (a flat map of dotted content paths -> value) under this key.
SITE_CONTENT_KEY = "site_content"


def _db_setting(db: Session, key: str, fallback: str = "") -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row and row.value else fallback


@router.get("/public")
def public_settings(db: Session = Depends(get_db)):
    """Non-sensitive public config the frontend needs. The private Telegram
    group invite is deliberately NOT here — it's members-only, see
    /settings/member below."""
    return {
        "ameriabank_enabled": bool(settings.AMERIABANK_CLIENT_ID and settings.AMERIABANK_USERNAME and settings.AMERIABANK_PASSWORD),
        "require_approval": _db_setting(db, "require_approval", "false").lower() == "true",
        "membership_price_display": _db_setting(db, "membership_price_display", ""),
        "club_description": _db_setting(db, "club_description", ""),
        "club_instagram": _db_setting(db, "club_instagram", ""),
        "club_location": _db_setting(db, "club_location", ""),
        "club_email": _db_setting(db, "club_email", ""),
        "club_phone": _db_setting(db, "club_phone", ""),
        # Login/register popup artwork, per language. Empty string means the
        # admin hasn't set one, and the frontend falls back to the image
        # bundled at build time.
        "auth_banner_hy": _db_setting(db, "auth_banner_hy", ""),
        "auth_banner_en": _db_setting(db, "auth_banner_en", ""),
        # SUPERSEDED — the old two-fixed-tier subscription pricing a member
        # picked between at Subscribe. No longer read by any live checkout
        # or gift path since the switch to credit packages (see "packages"
        # below); left commented as a rollback reference rather than removed.
        # "membership_plans": {
        #     "1": float(_db_setting(db, "membership_plan1_price", "") or 15000),
        #     "2": float(_db_setting(db, "membership_plan2_price", "") or 25000),
        # },
        # Credit-pack tiers a member picks between when buying or gifting —
        # see the Pricing section / admin Packages settings for the matching
        # marketing copy and price configuration.
        "packages": sorted(
            (p for p in get_packages_config(db) if p.get("active", True)),
            key=lambda p: p.get("sortOrder", 0),
        ),
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


@router.get("/site-content")
def site_content(db: Session = Depends(get_db)) -> dict:
    """Public landing-page copy overrides (a flat {dotted.path: value} map) the
    admin set via the Site Editor. The frontend deep-merges these onto the
    bundled default content, so an empty/absent value just means "use defaults"."""
    raw = _db_setting(db, SITE_CONTENT_KEY, "")
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except (ValueError, TypeError):
        return {}
