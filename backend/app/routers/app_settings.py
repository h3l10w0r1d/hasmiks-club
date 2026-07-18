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

# Site Editor stores landing-page overrides as one JSON blob (a flat map of
# dotted content paths -> value, plus a reserved "__layout" key). There are two
# copies: a working DRAFT the admin edits/previews, and the PUBLISHED copy the
# public site serves. "Publish" copies draft -> published.
SITE_CONTENT_KEY = "site_content"              # published (public reads this)
SITE_CONTENT_DRAFT_KEY = "site_content_draft"  # draft (editor + preview)
LAYOUT_KEY = "__layout"
# Guardrails so a malformed or oversized payload can't be persisted.
MAX_OVERRIDE_ENTRIES = 500
MAX_VALUE_LEN = 8000
MAX_LAYOUT_SECTIONS = 50

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


# ── Site Editor: landing-page overrides (draft + publish) ────────────────────
def _validate_layout(value: Any) -> list:
    """The reserved __layout key is an ordered list of {id: str, enabled: bool}
    controlling which sections show and in what order. Custom-block entries
    (id starting with "custom-") also carry a "type" (e.g. "text"/"imageText")
    naming which template to render — preserved here so the saved/published
    copy round-trips byte-for-byte with what the client sent (otherwise the
    editor's dirty-check never clears for a page with a custom block)."""
    if not isinstance(value, list):
        raise HTTPException(422, "__layout must be a list")
    if len(value) > MAX_LAYOUT_SECTIONS:
        raise HTTPException(422, "Too many layout sections")
    clean = []
    for item in value:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]:
            raise HTTPException(422, "Each __layout item needs a non-empty string id")
        entry = {"id": item["id"], "enabled": bool(item.get("enabled", True))}
        if isinstance(item.get("type"), str):
            entry["type"] = item["type"]
        clean.append(entry)
    return clean


def _validate_card_order(value: Any, key: str) -> list:
    """Reserved "*.__<x>Order" keys: an array of the ORIGINAL integer indices
    of a repeatable card list (e.g. Community's feature cards), in display order."""
    if not isinstance(value, list) or len(value) > MAX_LAYOUT_SECTIONS:
        raise HTTPException(422, f"'{key}' must be a list")
    if not all(isinstance(v, int) and not isinstance(v, bool) for v in value):
        raise HTTPException(422, f"'{key}' must contain only integers")
    return value


def _validate_card_hidden(value: Any, key: str) -> list:
    """Reserved "*.__<x>Hidden" keys: a boolean per ORIGINAL card index,
    True where that card is hidden."""
    if not isinstance(value, list) or len(value) > MAX_LAYOUT_SECTIONS:
        raise HTTPException(422, f"'{key}' must be a list")
    return [bool(v) for v in value]


def _validate_overrides(body: Any) -> dict:
    """Overrides are a flat map of dotted-path -> (str | list[str]), plus the
    reserved __layout key and the reserved per-card "__<x>Order"/"__<x>Hidden"
    list keys. We reject anything else so a bad payload can't corrupt the
    public landing page."""
    if not isinstance(body, dict):
        raise HTTPException(422, "Overrides must be an object")
    if len(body) > MAX_OVERRIDE_ENTRIES:
        raise HTTPException(422, f"Too many overrides (max {MAX_OVERRIDE_ENTRIES})")
    clean: dict = {}
    for key, value in body.items():
        if not isinstance(key, str) or not key:
            raise HTTPException(422, "Override keys must be non-empty strings")
        last_segment = key.rsplit(".", 1)[-1]
        if key == LAYOUT_KEY:
            clean[key] = _validate_layout(value)
        elif last_segment.startswith("__") and last_segment.endswith("Order"):
            clean[key] = _validate_card_order(value, key)
        elif last_segment.startswith("__") and last_segment.endswith("Hidden"):
            clean[key] = _validate_card_hidden(value, key)
        elif isinstance(value, str):
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


def _read_json(db: Session, key: str) -> dict:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not row or not row.value:
        return {}
    try:
        data = json.loads(row.value)
        return data if isinstance(data, dict) else {}
    except (ValueError, TypeError):
        return {}


@router.get("/site-content")
def get_site_content(
    env: str = "draft",
    db: Session = Depends(get_db),
    _: User = Depends(require_permission('manage_settings')),
) -> dict:
    """Return the draft (default) or published overrides. When no draft exists
    yet, fall back to the published copy so the editor opens on what's live."""
    if env == "published":
        return _read_json(db, SITE_CONTENT_KEY)
    draft_row = db.query(AppSetting).filter(AppSetting.key == SITE_CONTENT_DRAFT_KEY).first()
    if draft_row is not None:
        return _read_json(db, SITE_CONTENT_DRAFT_KEY)
    return _read_json(db, SITE_CONTENT_KEY)


@router.put("/site-content")
def update_site_content(
    body: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission('manage_settings')),
) -> dict:
    """Save the working DRAFT. The public site is unaffected until publish."""
    clean = _validate_overrides(body)
    _set(db, SITE_CONTENT_DRAFT_KEY, json.dumps(clean, ensure_ascii=False))
    return clean


@router.post("/site-content/publish")
def publish_site_content(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission('manage_settings')),
) -> dict:
    """Promote the current draft to the live/published copy."""
    draft = _read_json(db, SITE_CONTENT_DRAFT_KEY)
    _set(db, SITE_CONTENT_KEY, json.dumps(draft, ensure_ascii=False))
    return draft


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
