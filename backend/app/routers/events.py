from datetime import datetime, timezone
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.event import Event
from app.models.rsvp import RSVP
from app.models.waitlist import EventWaitlist
from app.models.user import User
from app.models.guest_ticket import GuestTicket
from app.schemas.event import EventCreate, EventOut, RSVPOut, PublicEventOut, GuestCheckoutIn, GuestTicketOut
from app.core.deps import get_current_user, get_current_active_member
from app.core import ameriabank
from app.core import email as mailer
from app.core import notify
from app.core.config import settings
from app.core.payment_log import log_payment_event

router = APIRouter(prefix="/events", tags=["events"])

LANG_MAP = {"en": "en", "hy": "am", "ru": "ru"}


def _paid_guest_count(event: Event) -> int:
    return sum(1 for g in event.guest_tickets if g.status in ameriabank.PAID_STATUSES)


def _serialize_event(event: Event, user_id: int) -> EventOut:
    guest_seats_taken = _paid_guest_count(event)
    seats_taken = len(event.rsvps) + guest_seats_taken
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
        ticket_price=event.ticket_price,
        max_guest_tickets=event.max_guest_tickets,
        guest_seats_taken=guest_seats_taken,
    )


def _serialize_public(event: Event) -> PublicEventOut:
    guest_seats_taken = _paid_guest_count(event)
    seats_taken = len(event.rsvps) + guest_seats_taken
    available = max(event.max_seats - seats_taken, 0)
    guest_tickets_available = None
    guest_tickets_full = False
    if event.ticket_price is not None:
        guest_tickets_available = available
        if event.max_guest_tickets is not None:
            guest_tickets_available = min(available, max(event.max_guest_tickets - guest_seats_taken, 0))
        guest_tickets_full = guest_tickets_available <= 0
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
        ticket_price=event.ticket_price,
        guest_tickets_available=guest_tickets_available,
        guest_tickets_full=guest_tickets_full,
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
                mailer.track_event_async(promoted_user.email, "event_waitlist_promoted", {"event_title": event.title})
                mailer.sync_member_to_brevo(db, promoted_user)
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
    mailer.track_event_async(current_user.email, "event_waitlist_joined", {"event_title": event.title, "position": position})
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


# ── one-time guest tickets (no account required) ───────────────────────────────

@router.post("/{event_id}/guest-checkout")
def guest_checkout(event_id: int, payload: GuestCheckoutIn, db: Session = Depends(get_db)):
    """Start a one-time ticket purchase for someone without a member account.
    Existing members are turned away here and pointed at login/subscribe
    instead — a one-time ticket is meant for first-time visitors, not as a
    way to dodge membership."""
    if not (settings.AMERIABANK_CLIENT_ID and settings.AMERIABANK_USERNAME and settings.AMERIABANK_PASSWORD):
        raise HTTPException(status_code=503, detail="Ticket purchases are not configured")

    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.ticket_price is None:
        raise HTTPException(status_code=400, detail="This event doesn't offer one-time tickets — membership required")
    if event.event_date < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This event has already happened")

    email = payload.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=409,
            detail="An account already exists for this email — please log in and subscribe instead of buying a one-time ticket",
        )

    guest_seats_taken = _paid_guest_count(event)
    seats_taken = len(event.rsvps) + guest_seats_taken
    if seats_taken >= event.max_seats:
        raise HTTPException(status_code=409, detail="This event is fully booked")
    if event.max_guest_tickets is not None and guest_seats_taken >= event.max_guest_tickets:
        raise HTTPException(status_code=409, detail="All one-time tickets for this event are sold out")

    ticket = GuestTicket(
        event_id=event.id, full_name=payload.full_name, email=email,
        amount=event.ticket_price, currency=settings.AMERIABANK_CURRENCY, status="started",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    try:
        ticket.order_id = ameriabank.next_order_id(db)
    except ameriabank.AmeriaBankError as exc:
        ticket.status = "error"
        ticket.response_message = str(exc)
        db.commit()
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    db.commit()

    init_request = {"OrderID": ticket.order_id, "Amount": float(event.ticket_price), "Currency": ticket.currency, "BackURL": settings.AMERIABANK_GUEST_BACK_URL}
    try:
        resp = ameriabank.init_payment(
            order_id=ticket.order_id,
            amount=event.ticket_price,
            description=f"{event.title} — one-time ticket ({payload.full_name})",
            back_url=settings.AMERIABANK_GUEST_BACK_URL,
        )
    except ameriabank.AmeriaBankError as exc:
        ticket.status = "error"
        ticket.response_message = str(exc)
        db.commit()
        log_payment_event(db, ticket.id, "init_payment", request_payload=init_request, response_payload={"error": str(exc)}, success=False)
        raise HTTPException(status_code=502, detail="Could not start payment — please try again shortly") from exc

    init_ok = resp.get("ResponseCode") == 1
    log_payment_event(db, ticket.id, "init_payment", request_payload=init_request, response_payload=resp, success=init_ok)
    if not init_ok:
        ticket.status = "error"
        ticket.response_message = resp.get("ResponseMessage")
        db.commit()
        raise HTTPException(status_code=502, detail=resp.get("ResponseMessage") or "Payment initialization failed")

    ticket.payment_id = resp.get("PaymentID")
    db.commit()

    mailer.track_event_async(email, "guest_checkout_started", {"event_title": event.title, "amount": float(event.ticket_price)})

    lang = LANG_MAP.get(payload.lang_pref, "en")
    return {"url": ameriabank.payment_page_url(ticket.payment_id, lang)}


@router.api_route("/guest-checkout/callback", methods=["GET", "POST"])
async def guest_checkout_callback(request: Request, db: Session = Depends(get_db)):
    """BackURL target for one-time guest ticket purchases — same verify-before-
    trust pattern as /payments/callback, kept as a separate route/table so
    guest purchases can never touch membership_status or the User model."""
    if request.method == "POST":
        params = dict(await request.form())
    else:
        params = dict(request.query_params)

    payment_id = params.get("paymentID") or params.get("PaymentID")
    order_id_raw = params.get("orderID") or params.get("OrderID")

    ticket = None
    if payment_id:
        ticket = db.query(GuestTicket).filter(GuestTicket.payment_id == payment_id).first()
    if not ticket and order_id_raw:
        try:
            ticket = db.query(GuestTicket).filter(GuestTicket.order_id == int(order_id_raw)).first()
        except ValueError:
            ticket = None

    outcome = "failed"
    if ticket and ticket.payment_id:
        verify_request = {"PaymentID": ticket.payment_id}
        try:
            details = ameriabank.get_payment_details(ticket.payment_id)
        except ameriabank.AmeriaBankError as exc:
            details = None
            log_payment_event(db, ticket.id, "verify_callback", request_payload=verify_request, response_payload={"error": str(exc)}, success=False)

        if details:
            was_already_paid = ticket.status in ameriabank.PAID_STATUSES
            ticket.response_code = details.get("ResponseCode")
            ticket.response_message = details.get("ResponseMessage")
            ticket.card_number = details.get("CardNumber")
            ticket.approval_code = details.get("ApprovalCode")
            ticket.rrn = details.get("rrn")

            ticket.status = ameriabank.status_from_details(details)
            is_success = ameriabank.is_paid(details)
            if is_success:
                outcome = "success"
            db.commit()
            log_payment_event(db, ticket.id, "verify_callback", request_payload=verify_request, response_payload=details, success=is_success)

            if not was_already_paid:
                event = db.query(Event).filter(Event.id == ticket.event_id).first()
                if is_success:
                    if event:
                        mailer.send_guest_ticket_confirmation(
                            ticket.email, ticket.full_name, event.title,
                            event.event_date.strftime("%B %d, %Y at %H:%M"), event.location,
                        )
                    mailer.track_event_async(ticket.email, "guest_ticket_purchased", {
                        "event_title": event.title if event else None, "amount": float(ticket.amount),
                    })
                    parts = ticket.full_name.split(" ", 1)
                    mailer.sync_contact_async(ticket.email, {
                        "FIRSTNAME": parts[0], "LASTNAME": parts[1] if len(parts) > 1 else "",
                        "SIGNUP_METHOD": "guest_ticket",
                    })
                else:
                    mailer.track_event_async(ticket.email, "guest_checkout_failed", {"response_message": ticket.response_message})

    target = settings.AMERIABANK_GUEST_SUCCESS_URL if outcome == "success" else settings.AMERIABANK_GUEST_CANCEL_URL
    return RedirectResponse(url=f"{target}?ticket={outcome}")
