from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.event import Event
from app.models.rsvp import RSVP
from app.models.user import User
from app.schemas.event import EventCreate, EventOut, RSVPOut
from app.core.deps import get_current_user, get_current_active_member

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
    )


@router.get("/", response_model=List[EventOut])
def list_events(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    events = db.query(Event).order_by(Event.event_date).all()
    return [_serialize_event(e, current_user.id) for e in events]


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return _serialize_event(event, current_user.id)


@router.post("/", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    event = Event(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return _serialize_event(event, 0)


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
    rsvp_obj = RSVP(user_id=current_user.id, event_id=event_id)
    db.add(rsvp_obj)
    db.commit()
    db.refresh(rsvp_obj)
    return rsvp_obj


@router.delete("/{event_id}/rsvp", status_code=status.HTTP_204_NO_CONTENT)
def cancel_rsvp(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rsvp_obj = db.query(RSVP).filter(RSVP.user_id == current_user.id, RSVP.event_id == event_id).first()
    if not rsvp_obj:
        raise HTTPException(status_code=404, detail="RSVP not found")
    db.delete(rsvp_obj)
    db.commit()
