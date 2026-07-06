from datetime import datetime, timezone
from typing import List

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, ProfilePhoto
from app.models.rsvp import RSVP
from app.models.event import Event
from app.models.content import ContentItem, MemberContent
from app.models.forum import ForumTopic, ForumPost
from app.schemas.user import (
    UserOut, UserUpdate, MemberDirectoryOut, ProfilePhotoOut,
    MemberProfileOut, MemberEventOut, MemberLibraryOut, MemberForumActivityOut,
)
from app.core.deps import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/members", tags=["members"])

MAX_PROFILE_PHOTOS = 6


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
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/photo", response_model=UserOut)
async def upload_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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


@router.get("/directory", response_model=List[MemberDirectoryOut])
def member_directory(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Active members who opted in to the directory."""
    return (
        db.query(User)
        .filter(User.membership_status == "active", User.show_in_directory == True, User.id != current_user.id)
        .order_by(User.full_name)
        .all()
    )


@router.get("/{user_id}", response_model=MemberProfileOut)
def get_member(user_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """A member's public profile: contact links, personal photos, and recent
    activity. Deliberately excludes anything private (email, admin notes,
    permissions, referral code) — see MemberProfileOut."""
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
