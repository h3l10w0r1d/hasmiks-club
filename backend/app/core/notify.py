import json

from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.models.user import User
from app.core.push import send_push_async

DEFAULT_CHANNELS = {"in_app": True, "push": True}


def get_channel_prefs(user: User, type: str) -> dict:
    """Per-type channel prefs from User.notification_prefs — a JSON object of
    {type: {"in_app": bool, "push": bool}}. Missing user prefs, missing type,
    or a missing channel key all default to enabled (opt-out, not opt-in)."""
    if not user or not user.notification_prefs:
        return dict(DEFAULT_CHANNELS)
    try:
        prefs = json.loads(user.notification_prefs)
    except (ValueError, TypeError):
        return dict(DEFAULT_CHANNELS)
    entry = prefs.get(type) if isinstance(prefs, dict) else None
    if not isinstance(entry, dict):
        return dict(DEFAULT_CHANNELS)
    return {"in_app": entry.get("in_app", True) is not False, "push": entry.get("push", True) is not False}


def push(
    db: Session,
    user_id: int,
    type: str,
    text: str,
    link: str | None = None,
) -> None:
    user = db.query(User).filter(User.id == user_id).first()
    channels = get_channel_prefs(user, type)
    if channels["in_app"]:
        db.add(Notification(user_id=user_id, type=type, text=text, link=link))
        db.flush()
    if channels["push"]:
        send_push_async(user_id, "Hasmik's Club", text, link)
