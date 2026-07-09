import csv
import io
import json
from datetime import datetime, timezone
from typing import List, Optional

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.ameria_payment import AmeriaPayment
from app.models.ameria_payment_log import AmeriaPaymentLog
from app.models.audit_log import AuditLog
from app.models.content import ContentItem, MemberContent
from app.models.event import Event
from app.models.notification import Notification
from app.models.rsvp import RSVP
from app.models.user import User
from app.schemas.content import ContentCreate, ContentOut
from app.schemas.event import EventCreate, EventOut
from app.schemas.user import UserOut, AdminUserUpdate
from app.core import ameriabank
from app.core import email as mailer
from app.core import notify
from app.core.audit import log as audit_log
from app.core.config import settings
from app.core.deps import get_current_user, get_current_admin, require_permission, ALL_PERMISSIONS, ROLE_PERMISSIONS, get_user_permissions
from app.core.payment_log import log_payment_event

router = APIRouter(prefix="/admin", tags=["admin"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _event_out(event: Event) -> EventOut:
    seats_taken = len(event.rsvps)
    return EventOut(
        id=event.id, title=event.title, title_hy=event.title_hy,
        description=event.description, description_hy=event.description_hy,
        location=event.location, event_date=event.event_date,
        max_seats=event.max_seats, seats_taken=seats_taken,
        seats_available=max(event.max_seats - seats_taken, 0), user_has_rsvp=False,
        cover_url=event.cover_url,
    )


def _content_out(item: ContentItem, unlocked: bool = False) -> ContentOut:
    return ContentOut(
        id=item.id, type=item.type, title=item.title, title_hy=item.title_hy,
        description=item.description, description_hy=item.description_hy,
        file_url=item.file_url, cover_url=item.cover_url,
        published_at=item.published_at, is_unlocked=unlocked,
    )


# ── members ───────────────────────────────────────────────────────────────────

@router.get("/members", response_model=List[UserOut])
def list_members(db: Session = Depends(get_db), _: User = Depends(require_permission('manage_members'))):
    return db.query(User).order_by(User.joined_at.desc()).all()


@router.get("/members/export")
def export_members_csv(db: Session = Depends(get_db), admin: User = Depends(require_permission('manage_members'))):
    members = db.query(User).order_by(User.joined_at).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "full_name", "email", "membership_status", "is_admin", "is_verified", "joined_at", "rsvp_count", "content_unlocks"])
    for m in members:
        writer.writerow([
            m.id, m.full_name, m.email, m.membership_status,
            m.is_admin, m.is_verified,
            m.joined_at.strftime("%Y-%m-%d") if m.joined_at else "",
            len(m.rsvps), len(m.unlocked_content),
        ])

    buf.seek(0)
    audit_log(db, "export_members_csv", admin_id=admin.id)
    db.commit()
    filename = f"members_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.patch("/members/{user_id}", response_model=UserOut)
def update_member(
    user_id: int, payload: AdminUserUpdate,
    db: Session = Depends(get_db), admin: User = Depends(require_permission('manage_members')),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    old_status = user.membership_status
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    audit_log(db, f"update_member: {payload.model_dump(exclude_unset=True)}", admin_id=admin.id, entity_type="user", entity_id=user_id)
    db.commit()
    db.refresh(user)
    if user.membership_status != old_status:
        mailer.sync_member_to_brevo(db, user)
        if user.membership_status == "active":
            notify.push(db, user.id, "system", "Your membership is now active! Welcome to Hasmik's Club 🌸")
            db.commit()
    return user


@router.delete("/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_permission('manage_members'))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    audit_log(db, f"delete_member: {user.email}", admin_id=admin.id, entity_type="user", entity_id=user_id)
    db.delete(user)
    db.commit()


@router.post("/members/{user_id}/telegram-invite")
def send_telegram_invite(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_permission('manage_members'))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not settings.TELEGRAM_INVITE_URL:
        raise HTTPException(status_code=503, detail="TELEGRAM_INVITE_URL not configured")
    mailer.send_telegram_invite(user.email, user.full_name, settings.TELEGRAM_INVITE_URL)
    audit_log(db, "send_telegram_invite", admin_id=admin.id, entity_type="user", entity_id=user_id)
    db.commit()
    return {"ok": True}


# ── applications ──────────────────────────────────────────────────────────────

@router.get("/applications")
def list_applications(db: Session = Depends(get_db), _: User = Depends(require_permission('manage_applications'))):
    """Pending membership applications."""
    users = db.query(User).filter(User.application_status == "pending").order_by(User.joined_at.desc()).all()
    return [UserOut.model_validate(u) for u in users]


@router.post("/applications/{user_id}/approve", response_model=UserOut)
def approve_application(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_permission('manage_applications'))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.application_status = "approved"
    audit_log(db, f"approve_application: {user.email}", admin_id=admin.id, entity_type="user", entity_id=user_id)
    db.commit()
    db.refresh(user)
    mailer.send_application_approved(user.email, user.full_name)
    mailer.sync_member_to_brevo(db, user)
    mailer.track_event_async(user.email, "application_approved")
    return user


@router.post("/applications/{user_id}/decline", response_model=UserOut)
def decline_application(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_permission('manage_applications'))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.application_status = "declined"
    audit_log(db, f"decline_application: {user.email}", admin_id=admin.id, entity_type="user", entity_id=user_id)
    db.commit()
    db.refresh(user)
    mailer.send_application_declined(user.email, user.full_name)
    mailer.track_event_async(user.email, "application_declined")
    mailer.sync_member_to_brevo(db, user)
    return user


# ── referrals ─────────────────────────────────────────────────────────────────

@router.get("/referrals")
def get_referrals(db: Session = Depends(get_db), _: User = Depends(require_permission('manage_members'))):
    """Leaderboard of members who have referred others."""
    from sqlalchemy import func
    rows = (
        db.query(User.referred_by_id, func.count(User.id).label("count"))
        .filter(User.referred_by_id.isnot(None))
        .group_by(User.referred_by_id)
        .order_by(func.count(User.id).desc())
        .all()
    )
    referrer_ids = [r.referred_by_id for r in rows]
    referrers = {u.id: u for u in db.query(User).filter(User.id.in_(referrer_ids)).all()} if referrer_ids else {}
    return [
        {
            "referrer_id": r.referred_by_id,
            "referrer_name": referrers[r.referred_by_id].full_name if r.referred_by_id in referrers else "Unknown",
            "referrer_email": (referrers[r.referred_by_id].email or "") if r.referred_by_id in referrers else "",
            "referral_count": r.count,
        }
        for r in rows
    ]


# ── image upload ──────────────────────────────────────────────────────────────

@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...), admin: User = Depends(get_current_admin)):
    if not settings.CLOUDINARY_CLOUD_NAME:
        raise HTTPException(status_code=503, detail="Image upload not configured")
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
    )
    data = await file.read()
    result = cloudinary.uploader.upload(data, folder="hasmiks-club-admin", resource_type="auto")
    return {"url": result["secure_url"]}


# ── events ────────────────────────────────────────────────────────────────────

@router.get("/events", response_model=List[EventOut])
def list_events(db: Session = Depends(get_db), _: User = Depends(require_permission('manage_events'))):
    return [_event_out(e) for e in db.query(Event).order_by(Event.event_date.desc()).all()]


class AttendeeOut(BaseModel):
    id: int
    full_name: str
    email: Optional[str] = None
    membership_status: str
    checked_in: bool = False
    model_config = {"from_attributes": False}


@router.get("/events/{event_id}/attendees", response_model=List[AttendeeOut])
def event_attendees(event_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission('manage_events'))):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    result = []
    for r in event.rsvps:
        u = db.query(User).filter(User.id == r.user_id).first()
        if u:
            result.append(AttendeeOut(
                id=u.id, full_name=u.full_name, email=u.email,
                membership_status=u.membership_status, checked_in=r.checked_in,
            ))
    return result


@router.post("/events/{event_id}/checkin/{user_id}")
def toggle_checkin(
    event_id: int, user_id: int,
    db: Session = Depends(get_db), admin: User = Depends(require_permission('manage_events')),
):
    rsvp = db.query(RSVP).filter(RSVP.event_id == event_id, RSVP.user_id == user_id).first()
    if not rsvp:
        raise HTTPException(status_code=404, detail="RSVP not found")
    rsvp.checked_in = not rsvp.checked_in
    action = "checkin" if rsvp.checked_in else "checkout"
    audit_log(db, f"{action}: user #{user_id} at event #{event_id}", admin_id=admin.id, entity_type="event", entity_id=event_id)
    db.commit()
    return {"checked_in": rsvp.checked_in}


@router.get("/events/{event_id}/checkin-token")
def get_checkin_token(
    event_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission('manage_events')),
):
    import secrets as _secrets
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not event.checkin_token:
        event.checkin_token = _secrets.token_urlsafe(16)
        db.commit()
    return {"event_id": event_id, "token": event.checkin_token, "checkin_url": f"/checkin/{event_id}?token={event.checkin_token}"}


@router.post("/events", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, db: Session = Depends(get_db), admin: User = Depends(require_permission('manage_events'))):
    event = Event(**payload.model_dump())
    db.add(event)
    audit_log(db, f"create_event: {payload.title}", admin_id=admin.id, entity_type="event")
    db.commit()
    db.refresh(event)
    return _event_out(event)


@router.patch("/events/{event_id}", response_model=EventOut)
def update_event(event_id: int, payload: EventCreate, db: Session = Depends(get_db), admin: User = Depends(require_permission('manage_events'))):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    audit_log(db, f"update_event: {event.title}", admin_id=admin.id, entity_type="event", entity_id=event_id)
    db.commit()
    db.refresh(event)
    return _event_out(event)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db), admin: User = Depends(require_permission('manage_events'))):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    audit_log(db, f"delete_event: {event.title}", admin_id=admin.id, entity_type="event", entity_id=event_id)
    db.delete(event)
    db.commit()


# ── content ───────────────────────────────────────────────────────────────────

@router.get("/content", response_model=List[ContentOut])
def list_content(db: Session = Depends(get_db), _: User = Depends(require_permission('manage_content'))):
    return [_content_out(i, True) for i in db.query(ContentItem).order_by(ContentItem.published_at.desc()).all()]


@router.post("/content", response_model=ContentOut, status_code=status.HTTP_201_CREATED)
def create_content(payload: ContentCreate, db: Session = Depends(get_db), admin: User = Depends(require_permission('manage_content'))):
    item = ContentItem(**payload.model_dump())
    db.add(item)
    db.flush()  # assign item.id before granting access below
    # New content is unlocked for all currently-active members immediately —
    # otherwise it silently sits invisible until someone remembers to click
    # "Unlock All" separately, which isn't obvious from the creation flow.
    active_users = db.query(User).filter(User.membership_status == "active").all()
    for user in active_users:
        db.add(MemberContent(user_id=user.id, content_id=item.id))
        notify.push(db, user.id, "content", f"New content unlocked: {item.title}", link="/dashboard?tab=library")
    audit_log(db, f"create_content: {payload.title} (auto-unlocked for {len(active_users)} active members)", admin_id=admin.id, entity_type="content")
    db.commit()
    db.refresh(item)
    for user in active_users:
        mailer.track_event_async(user.email, "content_unlocked", {"title": item.title, "type": item.type})
    return _content_out(item, True)


@router.patch("/content/{content_id}", response_model=ContentOut)
def update_content(content_id: int, payload: ContentCreate, db: Session = Depends(get_db), admin: User = Depends(require_permission('manage_content'))):
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    audit_log(db, f"update_content: {item.title}", admin_id=admin.id, entity_type="content", entity_id=content_id)
    db.commit()
    db.refresh(item)
    return _content_out(item, True)


@router.delete("/content/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_content(content_id: int, db: Session = Depends(get_db), admin: User = Depends(require_permission('manage_content'))):
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    audit_log(db, f"delete_content: {item.title}", admin_id=admin.id, entity_type="content", entity_id=content_id)
    db.delete(item)
    db.commit()


@router.post("/content/{content_id}/unlock/{user_id}", response_model=ContentOut)
def unlock_content(content_id: int, user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_permission('manage_content'))):
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    exists = db.query(MemberContent).filter(MemberContent.user_id == user_id, MemberContent.content_id == content_id).first()
    if not exists:
        db.add(MemberContent(user_id=user_id, content_id=content_id))
        notify.push(db, user_id, "content", f"New content unlocked for you: {item.title}", link="/dashboard?tab=library")
    audit_log(db, f"unlock_content: {item.title} for user #{user_id}", admin_id=admin.id, entity_type="content", entity_id=content_id)
    db.commit()
    if not exists:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            mailer.track_event_async(user.email, "content_unlocked", {"title": item.title, "type": item.type})
    return _content_out(item, True)


@router.post("/content/{content_id}/unlock-all", response_model=ContentOut)
def unlock_content_for_all_active(content_id: int, db: Session = Depends(get_db), admin: User = Depends(require_permission('manage_content'))):
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    active_users = db.query(User).filter(User.membership_status == "active").all()
    count = 0
    newly_unlocked = []
    for user in active_users:
        exists = db.query(MemberContent).filter(MemberContent.user_id == user.id, MemberContent.content_id == content_id).first()
        if not exists:
            db.add(MemberContent(user_id=user.id, content_id=content_id))
            notify.push(db, user.id, "content", f"New content unlocked: {item.title}", link="/dashboard?tab=library")
            newly_unlocked.append(user)
            count += 1
    audit_log(db, f"unlock_content_all: {item.title} ({count} members)", admin_id=admin.id, entity_type="content", entity_id=content_id)
    db.commit()
    for user in newly_unlocked:
        mailer.track_event_async(user.email, "content_unlocked", {"title": item.title, "type": item.type})
    return _content_out(item, True)


# ── broadcast email ───────────────────────────────────────────────────────────

class BroadcastPayload(BaseModel):
    subject: str
    body: str
    segment: str = "all"  # all | active | inactive


@router.post("/broadcast")
def broadcast_email(payload: BroadcastPayload, db: Session = Depends(get_db), admin: User = Depends(require_permission('broadcast'))):
    query = db.query(User)
    if payload.segment == "active":
        query = query.filter(User.membership_status == "active")
    elif payload.segment == "inactive":
        query = query.filter(User.membership_status == "inactive")
    members = query.all()
    for member in members:
        mailer.send_broadcast(member.email, member.full_name, payload.subject, payload.body)
    audit_log(
        db, f"broadcast_email to {payload.segment} ({len(members)} members): {payload.subject}",
        admin_id=admin.id,
    )
    db.commit()
    return {"sent_to": len(members)}


# ── audit log ─────────────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: int
    admin_id: int | None
    admin_name: str | None
    action: str
    entity_type: str | None
    entity_id: int | None
    details: str | None
    created_at: datetime

    model_config = {"from_attributes": False}


@router.get("/audit-log", response_model=List[AuditLogOut])
def get_audit_log(
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission('view_audit')),
):
    rows = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    admin_ids = {r.admin_id for r in rows if r.admin_id}
    admins = {u.id: u.full_name for u in db.query(User).filter(User.id.in_(admin_ids)).all()} if admin_ids else {}
    return [
        AuditLogOut(
            id=r.id, admin_id=r.admin_id, admin_name=admins.get(r.admin_id),
            action=r.action, entity_type=r.entity_type, entity_id=r.entity_id,
            details=r.details, created_at=r.created_at,
        )
        for r in rows
    ]


# ── stats (kept for backward compat) ─────────────────────────────────────────

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _: User = Depends(require_permission('view_analytics'))):
    return {
        "total_members": db.query(User).count(),
        "active_members": db.query(User).filter(User.membership_status == "active").count(),
        "inactive_members": db.query(User).filter(User.membership_status == "inactive").count(),
        "total_events": db.query(Event).count(),
        "total_rsvps": db.query(RSVP).count(),
        "total_content": db.query(ContentItem).count(),
    }


# ── Roles & Permissions ──────────────────────────────────────────────────────

@router.get("/roles")
def list_roles(db: Session = Depends(get_db), _: User = Depends(require_permission('manage_roles'))):
    users = db.query(User).order_by(User.full_name).all()
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "permissions": u.permissions,  # raw JSON string or None
            "effective_permissions": get_user_permissions(u),
            "is_admin": u.is_admin,
            "membership_status": u.membership_status,
        }
        for u in users
    ]


@router.put("/roles/{user_id}")
def update_role(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current: User = Depends(require_permission('manage_roles')),
):
    import json as _json
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == current.id:
        raise HTTPException(400, "Cannot change your own role")

    if "role" in payload:
        new_role = payload["role"]
        if new_role not in ("member", "moderator", "admin"):
            raise HTTPException(400, "Invalid role")
        user.role = new_role
        # Sync is_admin for backward compat
        user.is_admin = (new_role == "admin")

    if "permissions" in payload:
        perms = payload["permissions"]
        if perms is None:
            user.permissions = None  # reset to role defaults
        else:
            # Validate and store
            valid = [p for p in perms if p in ALL_PERMISSIONS]
            user.permissions = _json.dumps(valid)

    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "full_name": user.full_name,
        "role": user.role,
        "permissions": user.permissions,
        "effective_permissions": get_user_permissions(user),
    }


@router.get("/permissions/defaults")
def get_permission_defaults(_: User = Depends(get_current_admin)):
    return {
        "all_permissions": ALL_PERMISSIONS,
        "role_defaults": ROLE_PERMISSIONS,
    }


# ── payments (Ameriabank vPOS) ──────────────────────────────────────────────


def _serialize_payment(r: AmeriaPayment) -> dict:
    return {
        "id": r.id,
        "order_id": r.order_id,
        "payment_id": r.payment_id,
        "user_id": r.user_id,
        "amount": float(r.amount) if r.amount is not None else None,
        "currency": r.currency,
        "status": r.status,
        "response_code": r.response_code,
        "response_message": r.response_message,
        "card_number": r.card_number,
        "approval_code": r.approval_code,
        "rrn": r.rrn,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/payments")
def list_payments(db: Session = Depends(get_db), _: User = Depends(require_permission('manage_payments'))):
    rows = db.query(AmeriaPayment).order_by(AmeriaPayment.id.desc()).limit(200).all()
    return [_serialize_payment(r) for r in rows]


def _get_payment_row(payment_row_id: int, db: Session) -> AmeriaPayment:
    row = db.query(AmeriaPayment).filter(AmeriaPayment.id == payment_row_id).first()
    if not row or not row.payment_id:
        raise HTTPException(status_code=404, detail="Payment not found")
    return row


@router.post("/payments/{payment_row_id}/refresh")
def refresh_payment(payment_row_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission('manage_payments'))):
    row = _get_payment_row(payment_row_id, db)
    req = {"PaymentID": row.payment_id}
    try:
        details = ameriabank.get_payment_details(row.payment_id)
    except ameriabank.AmeriaBankError as exc:
        log_payment_event(db, row.id, "admin_refresh", request_payload=req, response_payload={"error": str(exc)}, success=False)
        raise HTTPException(status_code=502, detail=str(exc))

    row.response_code = details.get("ResponseCode")
    row.response_message = details.get("ResponseMessage")
    row.card_number = details.get("CardNumber")
    row.approval_code = details.get("ApprovalCode")
    row.rrn = details.get("rrn")
    row.status = ameriabank.status_from_details(details)
    # If the bank now shows this as paid but the buyer's membership was never
    # activated (e.g. an earlier callback misread the status), fix it here —
    # this makes "Refresh status" the one-click recovery for a stuck payment.
    if ameriabank.is_paid(details):
        user = db.query(User).filter(User.id == row.user_id).first()
        if user and user.membership_status != "active":
            user.membership_status = "active"
    db.commit()
    log_payment_event(db, row.id, "admin_refresh", request_payload=req, response_payload=details, success=True)
    return _serialize_payment(row)


@router.post("/payments/{payment_row_id}/refund")
def refund_payment(payment_row_id: int, body: dict, db: Session = Depends(get_db), _: User = Depends(require_permission('manage_payments'))):
    row = _get_payment_row(payment_row_id, db)
    amount = body.get("amount", float(row.amount))
    req = {"PaymentID": row.payment_id, "Amount": amount}
    try:
        resp = ameriabank.refund_payment(row.payment_id, amount)
    except ameriabank.AmeriaBankError as exc:
        log_payment_event(db, row.id, "admin_refund", request_payload=req, response_payload={"error": str(exc)}, success=False)
        raise HTTPException(status_code=502, detail=str(exc))
    ok = ameriabank.is_success_code(resp.get("ResponseCode"))
    log_payment_event(db, row.id, "admin_refund", request_payload=req, response_payload=resp, success=ok)
    if not ok:
        raise HTTPException(status_code=502, detail=resp.get("ResponseMessage") or "Refund failed")
    row.status = "refunded"
    db.commit()
    return _serialize_payment(row)


@router.post("/payments/{payment_row_id}/cancel")
def cancel_payment(payment_row_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission('manage_payments'))):
    row = _get_payment_row(payment_row_id, db)
    req = {"PaymentID": row.payment_id}
    try:
        resp = ameriabank.cancel_payment(row.payment_id)
    except ameriabank.AmeriaBankError as exc:
        log_payment_event(db, row.id, "admin_cancel", request_payload=req, response_payload={"error": str(exc)}, success=False)
        raise HTTPException(status_code=502, detail=str(exc))
    ok = ameriabank.is_success_code(resp.get("ResponseCode"))
    log_payment_event(db, row.id, "admin_cancel", request_payload=req, response_payload=resp, success=ok)
    if not ok:
        raise HTTPException(status_code=502, detail=resp.get("ResponseMessage") or "Cancel failed")
    row.status = "void"
    db.commit()
    return _serialize_payment(row)


@router.get("/payments/{payment_row_id}/logs")
def get_payment_logs(payment_row_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission('manage_payments'))):
    row = db.query(AmeriaPayment).filter(AmeriaPayment.id == payment_row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Payment not found")
    logs = (
        db.query(AmeriaPaymentLog)
        .filter(AmeriaPaymentLog.payment_row_id == payment_row_id)
        .order_by(AmeriaPaymentLog.created_at.asc(), AmeriaPaymentLog.id.asc())
        .all()
    )
    return [
        {
            "id": lg.id,
            "event": lg.event,
            "success": lg.success,
            "request_payload": json.loads(lg.request_payload) if lg.request_payload else None,
            "response_payload": json.loads(lg.response_payload) if lg.response_payload else None,
            "created_at": lg.created_at.isoformat() if lg.created_at else None,
        }
        for lg in logs
    ]
