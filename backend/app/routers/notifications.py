import json
from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.core.deps import get_current_user
from app.core.notify import get_channel_prefs

router = APIRouter(prefix="/notifications", tags=["notifications"])

# Every value ever passed as Notification.type (see app/core/notify.py call
# sites) — the preference center only exposes toggles for these.
NOTIFICATION_TYPES = ["rsvp", "waitlist", "content", "system"]


class NotificationOut(BaseModel):
    id: int
    type: str
    text: str
    link: str | None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationSummary(BaseModel):
    unread_count: int
    notifications: List[NotificationOut]


@router.get("", response_model=NotificationSummary)
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(30)
        .all()
    )
    unread = sum(1 for n in items if not n.is_read)
    return NotificationSummary(unread_count=unread, notifications=items)


@router.patch("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    n = db.query(Notification).filter(
        Notification.id == notification_id, Notification.user_id == current_user.id
    ).first()
    if n:
        n.is_read = True
        db.commit()


@router.patch("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Notification).filter(
        Notification.user_id == current_user.id, Notification.is_read == False
    ).update({"is_read": True})
    db.commit()


class ChannelPrefs(BaseModel):
    in_app: bool = True
    push: bool = True


class PreferencesOut(BaseModel):
    preferences: Dict[str, ChannelPrefs]


class PreferencesIn(BaseModel):
    preferences: Dict[str, ChannelPrefs]


@router.get("/preferences", response_model=PreferencesOut)
def get_preferences(current_user: User = Depends(get_current_user)):
    return PreferencesOut(preferences={t: get_channel_prefs(current_user, t) for t in NOTIFICATION_TYPES})


@router.put("/preferences", response_model=PreferencesOut)
def update_preferences(
    body: PreferencesIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    unknown = [t for t in body.preferences if t not in NOTIFICATION_TYPES]
    if unknown:
        raise HTTPException(422, f"Unknown notification type(s): {unknown}")

    try:
        current = json.loads(current_user.notification_prefs) if current_user.notification_prefs else {}
        if not isinstance(current, dict):
            current = {}
    except (ValueError, TypeError):
        current = {}

    for t, ch in body.preferences.items():
        current[t] = {"in_app": ch.in_app, "push": ch.push}

    current_user.notification_prefs = json.dumps(current)
    db.commit()
    return PreferencesOut(preferences={t: get_channel_prefs(current_user, t) for t in NOTIFICATION_TYPES})
