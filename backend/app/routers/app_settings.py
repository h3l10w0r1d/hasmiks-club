"""
Admin-managed settings stored in DB.
Keys: telegram_invite_url, require_approval, welcome_email_body,
      event_reminder_body, email_footer, membership_price_display,
      club_description, club_instagram, club_location
"""
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.database import get_db
from app.models.app_setting import AppSetting
from app.models.user import User

router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])

# Site Editor stores all landing-page copy overrides as one JSON blob (a flat
# map of dotted content paths -> string/list value) under this app_settings key.
SITE_CONTENT_KEY = "site_content"
# Guardrails so a malformed or oversized payload can't be persisted.
MAX_OVERRIDE_ENTRIES = 500
MAX_VALUE_LEN = 8000

PUBLIC_KEYS = {
    "telegram_invite_url",
    "require_approval",
    "membership_price_display",
    "club_description",
    "club_instagram",
    "club_location",
    "club_email",
    "club_phone",
    "gift_price_1m",
    "gift_price_3m",
    "gift_price_6m",
    "gift_price_12m",
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


@router.put("")
def update_settings_bulk(
    body: dict[str, str],
    db: Session = Depends(get_db),
    _: User = Depends(require_permission('manage_settings')),
) -> dict[str, str]:
    for key, value in body.items():
        _set(db, key, value)
    return body


# ── Site Editor: landing-page copy overrides ─────────────────────────────────
def _validate_overrides(body: Any) -> dict:
    """Overrides must be a flat map of dotted-path -> (str | list[str]). We
    reject anything else so a bad payload can't corrupt the public landing page."""
    if not isinstance(body, dict):
        raise HTTPException(422, "Overrides must be an object")
    if len(body) > MAX_OVERRIDE_ENTRIES:
        raise HTTPException(422, f"Too many overrides (max {MAX_OVERRIDE_ENTRIES})")
    clean: dict = {}
    for key, value in body.items():
        if not isinstance(key, str) or not key:
            raise HTTPException(422, "Override keys must be non-empty strings")
        if isinstance(value, str):
            if len(value) > MAX_VALUE_LEN:
                raise HTTPException(422, f"Value for '{key}' is too long")
            clean[key] = value
        elif isinstance(value, list):
            if not all(isinstance(v, str) for v in value):
                raise HTTPException(422, f"List value for '{key}' must contain only strings")
            if sum(len(v) for v in value) > MAX_VALUE_LEN:
                raise HTTPException(422, f"List value for '{key}' is too long")
            clean[key] = value
        else:
            raise HTTPException(422, f"Value for '{key}' must be a string or list of strings")
    return clean


@router.get("/site-content")
def get_site_content(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission('manage_settings')),
) -> dict:
    row = db.query(AppSetting).filter(AppSetting.key == SITE_CONTENT_KEY).first()
    if not row or not row.value:
        return {}
    try:
        data = json.loads(row.value)
        return data if isinstance(data, dict) else {}
    except (ValueError, TypeError):
        return {}


@router.put("/site-content")
def update_site_content(
    body: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission('manage_settings')),
) -> dict:
    clean = _validate_overrides(body)
    _set(db, SITE_CONTENT_KEY, json.dumps(clean, ensure_ascii=False))
    return clean


# Declared last so the literal /site-content routes above win over this
# single-segment path param (Starlette matches in declaration order).
@router.put("/{key}")
def update_setting(
    key: str,
    body: SettingIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission('manage_settings')),
) -> dict[str, str]:
    _set(db, key, body.value)
    return {"key": key, "value": body.value}
