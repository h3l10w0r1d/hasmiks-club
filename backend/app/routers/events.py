from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.event import Event
from app.models.rsvp import RSVP
from app.models.waitlist import EventWaitlist
from app.models.user import User
from app.schemas.event import EventCreate, EventOut, RSVPOut, PublicEventOut
from app.core.deps import get_current_user, get_current_active_member
from app.core import email as mailer
from app.core import notify

router = APIRouter(prefix="/events", tags=["events"])


def _serialize_event(event: Event, user_id: int) -> EventOut:
    seats_taken = len(event.rsvps)
    user_has_rsvp = any(r.user_id == user_id for r in event.rsvps)
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
        user_has_rsvp=user_has_rsvp,
        cover_url=event.cover_url,
    )


def _serialize_public(event: Event) -> PublicEventOut:
    seats_taken = len(event.rsvps)
    available = max(event.max_seats - seats_taken, 0)
    return PublicEventOut(
        id=event.id,
        title=event.title,
        title_hy=event.title_hy,
        description=event.description,
        description_hy=event.description_hy,
        location=event.location,
        event_date=event.event_date,
        max_seats=event.max_seats,
        seats_available=available,
        is_full=available == 0,
        cover_url=event.cover_url,
    )


# ── public (no auth) ──────────────────────────────────────────────────────────

@router.get("/public", response_model=List[PublicEventOut])
def list_public_events(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    events = db.query(Event).filter(Event.event_date >= now).order_by(Event.event_date).all()
    return [_serialize_public(e) for e in events]


# ── authenticated ─────────────────────────────────────────────────────────────

@router.get("/", response_model=List[EventOut])
def list_events(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    events = db.query(Event).filter(Event.event_date >= now).order_by(Event.event_date).all()
    return [_serialize_event(e, current_user.id) for e in events]


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return _serialize_event(event, current_user.id)


@router.post("/{event_id}/rsvp", response_model=RSVPOut, status_code=status.HTTP_201_CREATED)
def rsvp(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_member)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if len(event.rsvps) >= event.max_seats:
        raise HTTPException(status_code=409, detail="Event is fully booked")
    existing = db.query(RSVP).filter(RSVP.user_id == current_user.id, RSVP.event_id == event_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already RSVP'd")
    # Remove from waitlist if they were on it
    db.query(EventWaitlist).filter(
        EventWaitlist.user_id == current_user.id,
        EventWaitlist.event_id == event_id,
    ).delete()
    rsvp_obj = RSVP(user_id=current_user.id, event_id=event_id)
    db.add(rsvp_obj)
    notify.push(db, current_user.id, "rsvp", f"You're confirmed for {event.title}!", link="/dashboard?tab=events")
    db.commit()
    db.refresh(rsvp_obj)
    mailer.send_rsvp_confirmation(
        current_user.email, current_user.full_name, event.title,
        event.event_date.strftime("%B %d, %Y at %H:%M"), event.location,
    )
    mailer.track_event_async(current_user.email, "event_rsvp", {"event_title": event.title, "event_date": event.event_date.isoformat()})
    mailer.sync_member_to_brevo(db, current_user)
    return rsvp_obj


@router.delete("/{event_id}/rsvp", status_code=status.HTTP_204_NO_CONTENT)
def cancel_rsvp(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rsvp_obj = db.query(RSVP).filter(RSVP.user_id == current_user.id, RSVP.event_id == event_id).first()
    if not rsvp_obj:
        raise HTTPException(status_code=404, detail="RSVP not found")
    event = db.query(Event).filter(Event.id == event_id).first()
    db.delete(rsvp_obj)
    db.flush()

    # Promote first person on waitlist
    if event:
        next_in_line = (
            db.query(EventWaitlist)
            .filter(EventWaitlist.event_id == event_id)
            .order_by(EventWaitlist.created_at)
            .first()
        )
        if next_in_line:
            promoted_user = db.query(User).filter(User.id == next_in_line.user_id).first()
            db.delete(next_in_line)
            db.add(RSVP(user_id=next_in_line.user_id, event_id=event_id))
            notify.push(
                db, next_in_line.user_id, "waitlist",
                f"A spot opened for {event.title} — you're in!",
                link="/dashboard?tab=events",
            )
            db.flush()
            if promoted_user:
                mailer.send_waitlist_promoted(
                    promoted_user.email, promoted_user.full_name, event.title,
                    event.event_date.strftime("%B %d, %Y at %H:%M"), event.location,
                )
        mailer.send_rsvp_cancelled(current_user.email, current_user.full_name, event.title)
        mailer.track_event_async(current_user.email, "event_rsvp_cancelled", {"event_title": event.title})
        mailer.sync_member_to_brevo(db, current_user)

    db.commit()


# ── waitlist ──────────────────────────────────────────────────────────────────

@router.post("/{event_id}/waitlist", status_code=status.HTTP_201_CREATED)
def join_waitlist(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if len(event.rsvps) < event.max_seats:
        raise HTTPException(status_code=400, detail="Event still has seats — RSVP directly")
    existing_rsvp = db.query(RSVP).filter(RSVP.user_id == current_user.id, RSVP.event_id == event_id).first()
    if existing_rsvp:
        raise HTTPException(status_code=409, detail="Already RSVP'd")
    existing_wl = db.query(EventWaitlist).filter(
        EventWaitlist.user_id == current_user.id, EventWaitlist.event_id == event_id
    ).first()
    if existing_wl:
        raise HTTPException(status_code=409, detail="Already on waitlist")
    entry = EventWaitlist(user_id=current_user.id, event_id=event_id)
    db.add(entry)
    db.flush()
    position = (
        db.query(EventWaitlist)
        .filter(EventWaitlist.event_id == event_id)
        .order_by(EventWaitlist.created_at)
        .all()
        .index(entry) + 1
    )
    db.commit()
    mailer.send_waitlist_joined(current_user.email, current_user.full_name, event.title, position)
    return {"position": position, "event_id": event_id}


@router.delete("/{event_id}/waitlist", status_code=status.HTTP_204_NO_CONTENT)
def leave_waitlist(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    entry = db.query(EventWaitlist).filter(
        EventWaitlist.user_id == current_user.id, EventWaitlist.event_id == event_id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Not on waitlist")
    db.delete(entry)
    db.commit()


@router.get("/{event_id}/waitlist/position")
def waitlist_position(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    entries = (
        db.query(EventWaitlist)
        .filter(EventWaitlist.event_id == event_id)
        .order_by(EventWaitlist.created_at)
        .all()
    )
    for i, e in enumerate(entries):
        if e.user_id == current_user.id:
            return {"on_waitlist": True, "position": i + 1, "total": len(entries)}
    return {"on_waitlist": False}


@router.post("/{event_id}/checkin-self", status_code=204)
def self_checkin(
    event_id: int,
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Member self-check-in by scanning the event QR code."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.checkin_token != token:
        raise HTTPException(status_code=400, detail="Invalid check-in token")
    rsvp = db.query(RSVP).filter(RSVP.event_id == event_id, RSVP.user_id == current_user.id).first()
    if not rsvp:
        raise HTTPException(status_code=400, detail="You don't have an RSVP for this event")
    rsvp.checked_in = True
    db.commit()
    mailer.track_event_async(current_user.email, "event_checked_in", {"event_title": event.title})
    mailer.sync_member_to_brevo(db, current_user)
