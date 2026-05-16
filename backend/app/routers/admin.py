from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.event import Event
from app.models.rsvp import RSVP
from app.models.content import ContentItem, MemberContent
from app.schemas.user import UserOut, AdminUserUpdate
from app.schemas.event import EventCreate, EventOut
from app.schemas.content import ContentCreate, ContentOut
from app.core.deps import get_current_admin
from app.core import email as mailer
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["admin"])


# ── helpers ──────────────────────────────────────────────


def _event_out(event: Event, user_id: int = 0) -> EventOut:
    seats_taken = len(event.rsvps)
    return EventOut(
        id=event.id,
        title=event.title,
        title_hy=event.title_hy,
        description=event.description,
        description_hy=event.description_hy,
        location=event.location,
        event_date=event.event_date,
        max_seats=event.max_seats,
        seats_taken=seats_taken,
        seats_available=max(event.max_seats - seats_taken, 0),
        user_has_rsvp=False,
    )


def _content_out(item: ContentItem, unlocked: bool = False) -> ContentOut:
    return ContentOut(
        id=item.id,
        type=item.type,
        title=item.title,
        title_hy=item.title_hy,
        description=item.description,
        description_hy=item.description_hy,
        file_url=item.file_url,
        cover_url=item.cover_url,
        published_at=item.published_at,
        is_unlocked=unlocked,
    )


# ── members ──────────────────────────────────────────────


@router.get("/members", response_model=List[UserOut])
def list_members(db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    return db.query(User).order_by(User.joined_at.desc()).all()


@router.patch("/members/{user_id}", response_model=UserOut)
def update_member(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    old_status = user.membership_status
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    if user.membership_status != old_status:
        mailer.update_contact_status(user.email, user.membership_status)
    return user


@router.delete("/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(user_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()


# ── events ───────────────────────────────────────────────


@router.get("/events", response_model=List[EventOut])
def list_events(db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    return [_event_out(e) for e in db.query(Event).order_by(Event.event_date.desc()).all()]


@router.get("/events/{event_id}/attendees", response_model=List[UserOut])
def event_attendees(event_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    user_ids = [r.user_id for r in event.rsvps]
    return db.query(User).filter(User.id.in_(user_ids)).all()


@router.post("/events", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    event = Event(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return _event_out(event)


@router.patch("/events/{event_id}", response_model=EventOut)
def update_event(
    event_id: int,
    payload: EventCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return _event_out(event)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()


# ── content ──────────────────────────────────────────────


@router.get("/content", response_model=List[ContentOut])
def list_content(db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    return [_content_out(i, True) for i in db.query(ContentItem).order_by(ContentItem.published_at.desc()).all()]


@router.post("/content", response_model=ContentOut, status_code=status.HTTP_201_CREATED)
def create_content(payload: ContentCreate, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    item = ContentItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _content_out(item, True)


@router.patch("/content/{content_id}", response_model=ContentOut)
def update_content(
    content_id: int,
    payload: ContentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return _content_out(item, True)


@router.delete("/content/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_content(content_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    db.delete(item)
    db.commit()


@router.post("/content/{content_id}/unlock/{user_id}", response_model=ContentOut)
def unlock_content(
    content_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    exists = db.query(MemberContent).filter(
        MemberContent.user_id == user_id, MemberContent.content_id == content_id
    ).first()
    if not exists:
        db.add(MemberContent(user_id=user_id, content_id=content_id))
        db.commit()
    return _content_out(item, True)


@router.post("/content/{content_id}/unlock-all", response_model=ContentOut)
def unlock_content_for_all_active(
    content_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Unlock a content item for every active member."""
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    active_users = db.query(User).filter(User.membership_status == "active").all()
    for user in active_users:
        exists = db.query(MemberContent).filter(
            MemberContent.user_id == user.id, MemberContent.content_id == content_id
        ).first()
        if not exists:
            db.add(MemberContent(user_id=user.id, content_id=content_id))
    db.commit()
    return _content_out(item, True)


# ── stats ────────────────────────────────────────────────


@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    total_members = db.query(User).count()
    active_members = db.query(User).filter(User.membership_status == "active").count()
    inactive_members = db.query(User).filter(User.membership_status == "inactive").count()
    total_events = db.query(Event).count()
    total_rsvps = db.query(RSVP).count()
    total_content = db.query(ContentItem).count()

    events = db.query(Event).order_by(Event.event_date.desc()).all()
    event_stats = [
        {
            "id": e.id,
            "title": e.title,
            "event_date": e.event_date.isoformat(),
            "max_seats": e.max_seats,
            "rsvp_count": len(e.rsvps),
        }
        for e in events
    ]

    return {
        "total_members": total_members,
        "active_members": active_members,
        "inactive_members": inactive_members,
        "total_events": total_events,
        "total_rsvps": total_rsvps,
        "total_content": total_content,
        "events": event_stats,
    }
