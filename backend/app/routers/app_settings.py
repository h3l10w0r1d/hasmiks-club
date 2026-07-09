"""
Admin-managed settings stored in DB.
Keys: telegram_invite_url, require_approval, welcome_email_body,
      event_reminder_body, email_footer, membership_price_display,
      club_description, club_instagram, club_location
"""
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.database import get_db
from app.models.app_setting import AppSetting
from app.models.user import User

router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])

PUBLIC_KEYS = {
    "telegram_invite_url",
    "require_approval",
    "membership_price_display",
    "club_description",
    "club_instagram",
    "club_location",
    "club_email",
    "club_phone",
}

ALL_KEYS = PUBLIC_KEYS | {
    "welcome_email_body",
    "event_reminder_body",
    "email_footer",
}


class SettingIn(BaseModel):
    value: str


def _get_all(db: Session) -> dict[str, str]:
    rows = db.query(AppSetting).all()
    return {r.key: r.value or "" for r in rows}


def _set(db: Session, key: str, value: str) -> None:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))
    db.commit()


@router.get("")
def get_settings(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission('manage_settings')),
) -> dict[str, Any]:
    return _get_all(db)


@router.put("/{key}")
def update_setting(
    key: str,
    body: SettingIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission('manage_settings')),
) -> dict[str, str]:
    _set(db, key, body.value)
    return {"key": key, "value": body.value}


@router.put("")
def update_settings_bulk(
    body: dict[str, str],
    db: Session = Depends(get_db),
    _: User = Depends(require_permission('manage_settings')),
) -> dict[str, str]:
    for key, value in body.items():
        _set(db, key, value)
    return body
