from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/public")
def public_settings():
    """Non-sensitive public config the frontend needs."""
    return {
        "telegram_invite_url": settings.TELEGRAM_INVITE_URL,
        "stripe_enabled": bool(settings.STRIPE_SECRET_KEY and settings.STRIPE_PRICE_ID),
    }
