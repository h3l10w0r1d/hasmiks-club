import json
from datetime import datetime, timezone
from typing import List, Optional

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, ProfilePhoto
from app.models.rsvp import RSVP
from app.models.event import Event
from app.models.content import ContentItem, MemberContent
from app.models.forum import ForumTopic, ForumPost
from app.models.ameria_payment import AmeriaPayment
from app.schemas.user import (
    UserOut, UserUpdate, MemberDirectoryOut, ProfilePhotoOut,
    MemberProfileOut, MemberEventOut, MemberLibraryOut, MemberForumActivityOut,
)
from app.core.deps import get_current_user
from app.core.config import settings
from app.core.telegram_auth import TelegramSignInRequest, verify_telegram_payload
from app.core import email as mailer
from app.core.email import _is_profile_complete
from app.core.audit import log as audit_log
from app.core import ameriabank

router = APIRouter(prefix="/members", tags=["members"])

MAX_PROFILE_PHOTOS = 6


def _maybe_fire_profile_completed(user: User, was_complete: bool) -> None:
    if not was_complete and _is_profile_complete(user):
        mailer.track_event_async(user.email, "profile_completed")


def _configure_cloudinary():
    if not settings.CLOUDINARY_CLOUD_NAME:
        raise HTTPException(status_code=503, detail="Photo upload not configured")
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
    )


@router.get("/me", response_model=UserOut)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_profile(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    was_complete = _is_profile_complete(current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    _maybe_fire_profile_completed(current_user, was_complete)
    mailer.sync_member_to_brevo(db, current_user)
    return current_user


@router.post("/me/photo", response_model=UserOut)
async def upload_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    was_complete = _is_profile_complete(current_user)
    _configure_cloudinary()
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    contents = await file.read()
    result = cloudinary.uploader.upload(
        contents,
        folder="hasmiks-club/avatars",
        public_id=f"user_{current_user.id}",
        overwrite=True,
        transformation=[{"width": 400, "height": 400, "crop": "fill", "gravity": "face"}],
    )
    current_user.photo_url = result["secure_url"]
    db.commit()
    db.refresh(current_user)
    _maybe_fire_profile_completed(current_user, was_complete)
    mailer.sync_member_to_brevo(db, current_user)
    return current_user


@router.post("/me/photos", response_model=List[ProfilePhotoOut], status_code=201)
async def add_profile_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add one photo to the member's small personal gallery (capped)."""
    existing = db.query(ProfilePhoto).filter(ProfilePhoto.user_id == current_user.id).count()
    if existing >= MAX_PROFILE_PHOTOS:
        raise HTTPException(status_code=400, detail=f"You can add up to {MAX_PROFILE_PHOTOS} photos")
    _configure_cloudinary()
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    contents = await file.read()
    if len(contents) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be under 8 MB")
    result = cloudinary.uploader.upload(
        contents, folder="hasmiks-club/profile-photos", resource_type="image",
        transformation=[{"width": 1000, "height": 1000, "crop": "limit", "quality": "auto"}],
    )
    photo = ProfilePhoto(user_id=current_user.id, url=result["secure_url"], sort_order=existing)
    db.add(photo)
    db.commit()
    return db.query(ProfilePhoto).filter(ProfilePhoto.user_id == current_user.id).order_by(ProfilePhoto.sort_order).all()


@router.delete("/me/photos/{photo_id}", response_model=List[ProfilePhotoOut])
def delete_profile_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    photo = db.query(ProfilePhoto).filter(ProfilePhoto.id == photo_id, ProfilePhoto.user_id == current_user.id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    db.delete(photo)
    db.commit()
    return db.query(ProfilePhoto).filter(ProfilePhoto.user_id == current_user.id).order_by(ProfilePhoto.sort_order).all()


@router.post("/me/telegram", response_model=UserOut)
def link_telegram(
    payload: TelegramSignInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Attach a verified Telegram account to the currently-logged-in member —
    for someone who already has an email/password or Google account and wants
    to also be able to sign in with Telegram. Telegram sign-in itself can't
    auto-link this way (no email to match on), so this has to be an explicit
    action taken from inside the account it should attach to."""
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram Sign-In is not configured")
    verify_telegram_payload(payload)

    existing = db.query(User).filter(User.telegram_id == payload.id).first()
    if existing and existing.id != current_user.id:
        raise HTTPException(status_code=409, detail="This Telegram account is already linked to another member")

    current_user.telegram_id = payload.id
    if payload.username:
        current_user.telegram_username = payload.username
    db.commit()
    db.refresh(current_user)
    mailer.track_event_async(current_user.email, "telegram_connected")
    mailer.sync_member_to_brevo(db, current_user)
    return current_user


@router.delete("/me/telegram", response_model=UserOut)
def unlink_telegram(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.password_hash and not current_user.google_id:
        raise HTTPException(status_code=400, detail="Add a password or Google sign-in before disconnecting Telegram — you'd be locked out otherwise")
    current_user.telegram_id = None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/directory", response_model=List[MemberDirectoryOut])
def member_directory(
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Active members who opted in to the directory. Directory browsing itself
    is a paid perk — an inactive/never-subscribed account can't view it even
    though it would see nothing about itself either way."""
    if current_user.membership_status != "active":
        raise HTTPException(status_code=403, detail="Active membership required")
    query = db.query(User).filter(
        User.membership_status == "active", User.show_in_directory == True, User.id != current_user.id
    )
    if q and q.strip():
        query = query.filter(User.full_name.ilike(f"%{q.strip()}%"))
    return query.order_by(User.full_name).all()


@router.get("/me/export")
def export_my_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Self-service data export (GDPR-style right of access) — everything the
    admin CSV export has about this member, plus the data only they can see
    about themselves. Payment records are included with amount/date/status
    only; card numbers/approval codes/RRNs are never exposed here."""
    user = current_user
    rsvps = db.query(RSVP).filter(RSVP.user_id == user.id).all()
    unlocked = db.query(MemberContent).filter(MemberContent.user_id == user.id).all()
    topics = db.query(ForumTopic).filter(ForumTopic.user_id == user.id, ForumTopic.is_deleted == False).all()
    posts = db.query(ForumPost).filter(ForumPost.user_id == user.id, ForumPost.is_deleted == False).all()
    payments = db.query(AmeriaPayment).filter(AmeriaPayment.user_id == user.id).order_by(AmeriaPayment.created_at).all()

    payload = {
        "profile": {
            "id": user.id, "email": user.email, "full_name": user.full_name,
            "phone": user.phone, "whatsapp": user.whatsapp, "facebook_url": user.facebook_url,
            "telegram_username": user.telegram_username, "bio": user.bio,
            "membership_status": user.membership_status, "joined_at": user.joined_at.isoformat() if user.joined_at else None,
            "lang_pref": user.lang_pref, "show_in_directory": user.show_in_directory,
            "referral_code": user.referral_code,
        },
        "profile_photos": [p.url for p in user.profile_photos],
        "event_rsvps": [{"event_id": r.event_id, "created_at": r.created_at.isoformat() if r.created_at else None, "checked_in": r.checked_in} for r in rsvps],
        "unlocked_content": [{"content_id": c.content_id, "unlocked_at": c.unlocked_at.isoformat() if c.unlocked_at else None} for c in unlocked],
        "forum_topics": [{"id": t.id, "title": t.title, "body": t.body, "created_at": t.created_at.isoformat() if t.created_at else None} for t in topics],
        "forum_posts": [{"id": p.id, "topic_id": p.topic_id, "body": p.body, "created_at": p.created_at.isoformat() if p.created_at else None} for p in posts],
        "payments": [{"amount": float(p.amount), "currency": p.currency, "status": p.status, "created_at": p.created_at.isoformat() if p.created_at else None} for p in payments],
    }
    filename = f"my-data-{datetime.now(timezone.utc).strftime('%Y%m%d')}.json"
    return JSONResponse(content=payload, headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.delete("/me")
def delete_my_account(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Self-service account deletion. Anonymizes personal fields and closes
    the account rather than hard-deleting the row — RSVPs/payments/forum
    posts stay referentially intact (accounting + community-history reasons),
    they just no longer point to any identifiable person. Irreversible."""
    user = current_user

    if user.binding_active and user.card_holder_id:
        try:
            ameriabank.deactivate_binding(user.card_holder_id)
        except ameriabank.AmeriaBankError:
            pass  # best-effort — don't block account closure on the bank being unreachable

    for photo in list(user.profile_photos):
        db.delete(photo)

    user.full_name = "Deleted member"
    user.email = None
    user.password_hash = None
    user.google_id = None
    user.telegram_id = None
    user.telegram_username = None
    user.photo_url = None
    user.bio = None
    user.facebook_url = None
    user.phone = None
    user.whatsapp = None
    user.admin_notes = None
    user.referral_code = None
    user.show_in_directory = False
    user.membership_status = "cancelled"
    user.binding_active = False
    user.card_holder_id = None
    user.verification_token = None

    audit_log(db, "self_delete_account", admin_id=user.id, entity_type="user", entity_id=user.id)
    db.commit()
    return {"deleted": True}


@router.get("/{user_id}", response_model=MemberProfileOut)
def get_member(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """A member's public profile: contact links, personal photos, and recent
    activity. Deliberately excludes anything private (email, admin notes,
    permissions, referral code) — see MemberProfileOut."""
    if current_user.membership_status != "active":
        raise HTTPException(status_code=403, detail="Active membership required")
    user = (
        db.query(User)
        .filter(User.id == user_id, User.membership_status == "active", User.show_in_directory == True)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")

    now = datetime.now(timezone.utc)
    attended = (
        db.query(Event)
        .join(RSVP, RSVP.event_id == Event.id)
        .filter(RSVP.user_id == user_id, Event.event_date < now)
        .order_by(Event.event_date.desc())
        .limit(8)
        .all()
    )
    library = (
        db.query(ContentItem)
        .join(MemberContent, MemberContent.content_id == ContentItem.id)
        .filter(MemberContent.user_id == user_id)
        .order_by(MemberContent.unlocked_at.desc())
        .limit(8)
        .all()
    )
    topics = (
        db.query(ForumTopic)
        .filter(ForumTopic.user_id == user_id, ForumTopic.is_deleted == False)
        .order_by(ForumTopic.created_at.desc())
        .limit(5)
        .all()
    )
    posts = (
        db.query(ForumPost)
        .filter(ForumPost.user_id == user_id, ForumPost.is_deleted == False)
        .order_by(ForumPost.created_at.desc())
        .limit(5)
        .all()
    )
    forum_activity = sorted(
        [
            MemberForumActivityOut(kind="topic", topic_id=t.id, title=t.title, snippet=t.body[:140], created_at=t.created_at)
            for t in topics
        ] + [
            MemberForumActivityOut(kind="post", topic_id=p.topic_id, title=p.topic.title if p.topic else "", snippet=p.body[:140], created_at=p.created_at)
            for p in posts
        ],
        key=lambda a: a.created_at, reverse=True,
    )[:5]

    return MemberProfileOut(
        id=user.id, full_name=user.full_name, photo_url=user.photo_url, bio=user.bio,
        joined_at=user.joined_at, facebook_url=user.facebook_url, telegram_username=user.telegram_username,
        phone=user.phone, whatsapp=user.whatsapp,
        profile_photos=[ProfilePhotoOut.model_validate(p) for p in user.profile_photos],
        attended_events=[MemberEventOut(id=e.id, title=e.title, event_date=e.event_date) for e in attended],
        library_items=[MemberLibraryOut(id=c.id, title=c.title, type=c.type) for c in library],
        forum_activity=forum_activity,
    )
