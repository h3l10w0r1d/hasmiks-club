import json
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.event import Event
from app.models.user import User
from app.models.gift_card import GiftCard
from app.models.guest_ticket import GuestTicket
from app.models.app_setting import AppSetting
from app.schemas.gift import (
    GiftStartIn, GiftVerifyIn, GiftCheckoutIn, GiftStartOut, GiftInfoOut,
    GiftClaimPasswordIn, GiftCardOut,
)
from app.schemas.user import TokenOut, UserOut
from app.core.deps import get_current_user
from app.core import ameriabank
from app.core import email as mailer
from app.core.config import settings
from app.core.payment_log import log_gift_event
from app.core.security import hash_password, create_access_token

router = APIRouter(prefix="/gift", tags=["gift"])

LANG_MAP = {"en": "en", "hy": "am", "ru": "ru"}
CODE_EXPIRY_MINUTES = 10
RESEND_COOLDOWN_SECONDS = 60
MAX_VERIFICATION_ATTEMPTS = 5
MEMBERSHIP_DURATIONS = (1, 3, 6, 12)


def _gen_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _paid_guest_count(event: Event) -> int:
    return sum(1 for g in event.guest_tickets if g.status in ameriabank.PAID_STATUSES)


def _db_setting(db: Session, key: str, fallback: str = "") -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row and row.value else fallback


def _gift_membership_price(db: Session, months: int) -> Decimal:
    override = _db_setting(db, f"gift_price_{months}m", "")
    if override:
        return Decimal(override)
    return Decimal(str(settings.AMERIABANK_MEMBERSHIP_AMOUNT)) * months


def _validate_gift_request(db: Session, payload: GiftStartIn) -> tuple[Decimal, str]:
    """Returns (amount, human-readable description). Raises HTTPException on
    any validation failure. Read-only — does not touch the DB."""
    if payload.gift_type == "membership":
        if payload.duration_months not in MEMBERSHIP_DURATIONS:
            raise HTTPException(status_code=400, detail="duration_months must be 1, 3, 6, or 12")
        amount = _gift_membership_price(db, payload.duration_months)
        return amount, f"{payload.duration_months}-month Hasmik's Club membership gift"

    if payload.gift_type == "events":
        if not payload.event_selections:
            raise HTTPException(status_code=400, detail="Select at least one event")
        total = Decimal("0")
        titles = []
        for sel in payload.event_selections:
            if sel.quantity < 1:
                raise HTTPException(status_code=400, detail="Quantity must be at least 1")
            event = db.query(Event).filter(Event.id == sel.event_id).first()
            if not event:
                raise HTTPException(status_code=404, detail=f"Event #{sel.event_id} not found")
            if event.ticket_price is None:
                raise HTTPException(status_code=400, detail=f"'{event.title}' doesn't offer one-time tickets")
            if event.event_date < datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail=f"'{event.title}' has already happened")
            guest_seats_taken = _paid_guest_count(event)
            seats_taken = len(event.rsvps) + guest_seats_taken
            if event.max_guest_tickets is not None and guest_seats_taken + sel.quantity > event.max_guest_tickets:
                raise HTTPException(status_code=409, detail=f"Not enough one-time tickets left for '{event.title}'")
            if seats_taken + sel.quantity > event.max_seats:
                raise HTTPException(status_code=409, detail=f"Not enough seats left for '{event.title}'")
            total += event.ticket_price * sel.quantity
            titles.append(f"{event.title} x{sel.quantity}")
        return total, "; ".join(titles)

    raise HTTPException(status_code=400, detail="gift_type must be 'membership' or 'events'")


# ── purchase flow (giver side) ──────────────────────────────────────────────

@router.post("/start", response_model=GiftStartOut, status_code=status.HTTP_201_CREATED)
def gift_start(payload: GiftStartIn, db: Session = Depends(get_db)):
    """Step 1 of 3: collect giver + recipient info, email the giver a 6-digit
    code. Nothing is charged yet — a typo'd giver email would otherwise mean
    a paid gift nobody gets a receipt for, and the recipient might never
    hear about it either."""
    giver_email = payload.giver_email.strip().lower()
    recipient_email = payload.recipient_email.strip().lower()
    amount, description = _validate_gift_request(db, payload)

    gift = GiftCard(
        giver_name=payload.giver_name, giver_email=giver_email, giver_phone=payload.giver_phone,
        recipient_name=payload.recipient_name, recipient_email=recipient_email, recipient_phone=payload.recipient_phone,
        anonymous=payload.anonymous, gift_type=payload.gift_type, duration_months=payload.duration_months,
        event_selections_json=json.dumps([s.model_dump() for s in payload.event_selections]) if payload.event_selections else None,
        amount=amount, currency=settings.AMERIABANK_CURRENCY, status="unverified",
        verification_code=_gen_code(), verification_sent_at=datetime.now(timezone.utc),
    )
    db.add(gift)
    db.commit()
    db.refresh(gift)

    mailer.send_gift_verification_code(gift.giver_email, gift.giver_name, gift.verification_code, gift.recipient_name)
    return GiftStartOut(gift_id=gift.id, resend_available_in=RESEND_COOLDOWN_SECONDS)


@router.post("/{gift_id}/resend-code", response_model=GiftStartOut)
def gift_resend_code(gift_id: int, db: Session = Depends(get_db)):
    gift = db.query(GiftCard).filter(GiftCard.id == gift_id).first()
    if not gift:
        raise HTTPException(status_code=404, detail="Gift not found")
    if gift.email_verified:
        raise HTTPException(status_code=400, detail="Already verified")
    elapsed = (datetime.now(timezone.utc) - gift.verification_sent_at.replace(tzinfo=timezone.utc)).total_seconds()
    if elapsed < RESEND_COOLDOWN_SECONDS:
        raise HTTPException(status_code=429, detail=f"Please wait {int(RESEND_COOLDOWN_SECONDS - elapsed)}s before requesting another code")

    gift.verification_code = _gen_code()
    gift.verification_sent_at = datetime.now(timezone.utc)
    gift.verification_attempts = 0
    db.commit()
    mailer.send_gift_verification_code(gift.giver_email, gift.giver_name, gift.verification_code, gift.recipient_name)
    return GiftStartOut(gift_id=gift.id, resend_available_in=RESEND_COOLDOWN_SECONDS)


@router.post("/{gift_id}/verify")
def gift_verify(gift_id: int, payload: GiftVerifyIn, db: Session = Depends(get_db)):
    gift = db.query(GiftCard).filter(GiftCard.id == gift_id).first()
    if not gift:
        raise HTTPException(status_code=404, detail="Gift not found")
    if gift.email_verified:
        return {"verified": True}
    if gift.verification_attempts >= MAX_VERIFICATION_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect attempts — request a new code")
    expires_at = gift.verification_sent_at.replace(tzinfo=timezone.utc) + timedelta(minutes=CODE_EXPIRY_MINUTES)
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="This code has expired — request a new one")
    if payload.code.strip() != gift.verification_code:
        gift.verification_attempts += 1
        db.commit()
        remaining = MAX_VERIFICATION_ATTEMPTS - gift.verification_attempts
        raise HTTPException(status_code=400, detail=f"Incorrect code — {remaining} attempt{'s' if remaining != 1 else ''} left")

    gift.email_verified = True
    gift.status = "started"
    db.commit()
    return {"verified": True}


@router.post("/{gift_id}/checkout")
def gift_checkout(gift_id: int, payload: GiftCheckoutIn, db: Session = Depends(get_db)):
    """Step 3 of 3: email is confirmed — actually start the Ameriabank
    payment. Re-validates event capacity since time has passed since step 1."""
    if not (settings.AMERIABANK_CLIENT_ID and settings.AMERIABANK_USERNAME and settings.AMERIABANK_PASSWORD):
        raise HTTPException(status_code=503, detail="Gift purchases are not configured")

    gift = db.query(GiftCard).filter(GiftCard.id == gift_id).first()
    if not gift:
        raise HTTPException(status_code=404, detail="Gift not found")
    if not gift.email_verified:
        raise HTTPException(status_code=403, detail="Please verify your email first")

    # Re-check capacity/pricing hasn't shifted since /start.
    if gift.gift_type == "events" and gift.event_selections_json:
        from app.schemas.gift import GiftEventSelection
        selections = [GiftEventSelection(**s) for s in json.loads(gift.event_selections_json)]
        recheck = GiftStartIn(
            giver_name=gift.giver_name, giver_email=gift.giver_email, recipient_name=gift.recipient_name,
            recipient_email=gift.recipient_email, gift_type="events", event_selections=selections,
        )
        _validate_gift_request(db, recheck)

    try:
        gift.order_id = ameriabank.next_order_id(db)
    except ameriabank.AmeriaBankError as exc:
        gift.status = "error"
        gift.response_message = str(exc)
        db.commit()
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    db.commit()

    init_request = {"OrderID": gift.order_id, "Amount": float(gift.amount), "Currency": gift.currency, "BackURL": settings.AMERIABANK_GIFT_BACK_URL}
    try:
        resp = ameriabank.init_payment(
            order_id=gift.order_id,
            amount=gift.amount,
            description=f"Hasmik's Club gift — {gift.recipient_name} ({gift.giver_name})",
            back_url=settings.AMERIABANK_GIFT_BACK_URL,
        )
    except ameriabank.AmeriaBankError as exc:
        gift.status = "error"
        gift.response_message = str(exc)
        db.commit()
        log_gift_event(db, gift.id, "init_payment", request_payload=init_request, response_payload={"error": str(exc)}, success=False)
        raise HTTPException(status_code=502, detail="Could not start payment — please try again shortly") from exc

    init_ok = resp.get("ResponseCode") == 1
    log_gift_event(db, gift.id, "init_payment", request_payload=init_request, response_payload=resp, success=init_ok)
    if not init_ok:
        gift.status = "error"
        gift.response_message = resp.get("ResponseMessage")
        db.commit()
        raise HTTPException(status_code=502, detail=resp.get("ResponseMessage") or "Payment initialization failed")

    gift.payment_id = resp.get("PaymentID")
    db.commit()

    mailer.track_event_async(gift.giver_email, "gift_checkout_started", {"gift_type": gift.gift_type, "amount": float(gift.amount)})

    lang = LANG_MAP.get(payload.lang_pref, "en")
    return {"url": ameriabank.payment_page_url(gift.payment_id, lang)}


def _deliver_membership_gift(db: Session, gift: GiftCard) -> None:
    existing = db.query(User).filter(User.email == gift.recipient_email).first()
    giver_name = None if gift.anonymous else gift.giver_name
    if existing:
        now = datetime.now(timezone.utc)
        base = now if not existing.membership_expires_at else max(now, existing.membership_expires_at.replace(tzinfo=timezone.utc))
        existing.membership_status = "active"
        existing.membership_expires_at = base + timedelta(days=30 * gift.duration_months)
        gift.applied_to_user_id = existing.id
        gift.redeemed = True
        gift.redeemed_at = now
        db.commit()
        mailer.send_gift_applied_existing(
            existing.email, existing.full_name, giver_name, gift.duration_months,
            existing.membership_expires_at.strftime("%B %d, %Y"),
        )
    else:
        gift.redemption_token = secrets.token_urlsafe(32)
        db.commit()
        claim_url = f"{settings.GIFT_CLAIM_BASE_URL}/{gift.redemption_token}"
        mailer.send_gift_claim_link(gift.recipient_email, gift.recipient_name, giver_name, gift.duration_months, claim_url)


def _deliver_events_gift(db: Session, gift: GiftCard) -> None:
    if not gift.event_selections_json:
        return
    giver_name = None if gift.anonymous else gift.giver_name
    selections = json.loads(gift.event_selections_json)
    tickets_for_email = []
    for sel in selections:
        event = db.query(Event).filter(Event.id == sel["event_id"]).first()
        if not event:
            continue
        per_ticket_amount = event.ticket_price
        for _ in range(sel["quantity"]):
            ticket = GuestTicket(
                event_id=event.id, gift_card_id=gift.id,
                full_name=gift.recipient_name, email=gift.recipient_email, phone=gift.recipient_phone,
                amount=per_ticket_amount, currency=gift.currency, status="deposited",
                email_verified=True, checkin_token=secrets.token_urlsafe(24),
            )
            db.add(ticket)
            db.commit()
            db.refresh(ticket)
            qr_url = mailer.qr_image_url(f"HC-GT:{ticket.id}:{ticket.checkin_token}")
            tickets_for_email.append({
                "event_title": event.title,
                "event_date": event.event_date.strftime("%B %d, %Y at %H:%M"),
                "location": event.location,
                "qr_url": qr_url,
            })
    gift.redeemed = True
    gift.redeemed_at = datetime.now(timezone.utc)
    db.commit()
    if tickets_for_email:
        mailer.send_gift_tickets(gift.recipient_email, gift.recipient_name, giver_name, tickets_for_email)


@router.api_route("/callback", methods=["GET", "POST"])
async def gift_callback(request: Request, db: Session = Depends(get_db)):
    """BackURL target — same verify-before-trust pattern as /payments/callback
    and /events/guest-checkout/callback."""
    if request.method == "POST":
        params = dict(await request.form())
    else:
        params = dict(request.query_params)

    payment_id = params.get("paymentID") or params.get("PaymentID")
    order_id_raw = params.get("orderID") or params.get("OrderID")

    gift = None
    if payment_id:
        gift = db.query(GiftCard).filter(GiftCard.payment_id == payment_id).first()
    if not gift and order_id_raw:
        try:
            gift = db.query(GiftCard).filter(GiftCard.order_id == int(order_id_raw)).first()
        except ValueError:
            gift = None

    outcome = "failed"
    if gift and gift.payment_id:
        verify_request = {"PaymentID": gift.payment_id}
        try:
            details = ameriabank.get_payment_details(gift.payment_id)
        except ameriabank.AmeriaBankError as exc:
            details = None
            log_gift_event(db, gift.id, "verify_callback", request_payload=verify_request, response_payload={"error": str(exc)}, success=False)

        if details:
            was_already_paid = gift.status in ameriabank.PAID_STATUSES
            gift.response_code = details.get("ResponseCode")
            gift.response_message = details.get("ResponseMessage")
            gift.card_number = details.get("CardNumber")
            gift.approval_code = details.get("ApprovalCode")
            gift.rrn = details.get("rrn")

            gift.status = ameriabank.status_from_details(details)
            is_success = ameriabank.is_paid(details)
            if is_success:
                outcome = "success"
            db.commit()
            log_gift_event(db, gift.id, "verify_callback", request_payload=verify_request, response_payload=details, success=is_success)

            if not was_already_paid:
                if is_success:
                    if gift.gift_type == "membership":
                        _deliver_membership_gift(db, gift)
                        detail_line = f"{gift.duration_months}-month membership for {gift.recipient_name}"
                    else:
                        _deliver_events_gift(db, gift)
                        detail_line = f"Event ticket(s) for {gift.recipient_name}"
                    mailer.send_gift_giver_receipt(gift.giver_email, gift.giver_name, gift.recipient_name, detail_line, gift.amount)
                    mailer.track_event_async(gift.giver_email, "gift_purchased", {"gift_type": gift.gift_type, "amount": float(gift.amount)})
                else:
                    mailer.track_event_async(gift.giver_email, "gift_checkout_failed", {"response_message": gift.response_message})

    target = settings.AMERIABANK_GIFT_SUCCESS_URL if outcome == "success" else settings.AMERIABANK_GIFT_CANCEL_URL
    return RedirectResponse(url=f"{target}?gift={outcome}")


# ── redemption flow (recipient side, membership gifts only) ────────────────

@router.get("/claim/{token}", response_model=GiftInfoOut)
def gift_claim_info(token: str, db: Session = Depends(get_db)):
    gift = db.query(GiftCard).filter(GiftCard.redemption_token == token).first()
    if not gift:
        raise HTTPException(status_code=404, detail="This gift link is invalid")
    recipient_has_account = db.query(User).filter(User.email == gift.recipient_email).first() is not None
    return GiftInfoOut(
        recipient_name=gift.recipient_name,
        giver_name=None if gift.anonymous else gift.giver_name,
        gift_type=gift.gift_type,
        duration_months=gift.duration_months,
        already_redeemed=gift.redeemed,
        recipient_has_account=recipient_has_account,
    )


@router.post("/claim/{token}/password", response_model=TokenOut)
def gift_claim_password(token: str, payload: GiftClaimPasswordIn, db: Session = Depends(get_db)):
    gift = db.query(GiftCard).filter(GiftCard.redemption_token == token).first()
    if not gift:
        raise HTTPException(status_code=404, detail="This gift link is invalid")
    if gift.redeemed:
        raise HTTPException(status_code=400, detail="This gift has already been claimed")
    if db.query(User).filter(User.email == gift.recipient_email).first():
        raise HTTPException(status_code=409, detail="An account already exists for this email — please log in instead")

    now = datetime.now(timezone.utc)
    user = User(
        email=gift.recipient_email, password_hash=hash_password(payload.password),
        full_name=gift.recipient_name, phone=gift.recipient_phone,
        is_verified=True,  # possession of the unique emailed claim link is proof of ownership
        membership_status="active",
        membership_expires_at=now + timedelta(days=30 * gift.duration_months),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    gift.applied_to_user_id = user.id
    gift.redeemed = True
    gift.redeemed_at = now
    db.commit()

    mailer.sync_member_to_brevo(db, user)
    mailer.track_event_async(user.email, "gift_claimed", {"duration_months": gift.duration_months})

    token_str = create_access_token(str(user.id))
    return TokenOut(access_token=token_str, user=UserOut.model_validate(user))


@router.post("/claim/{token}", response_model=TokenOut)
def gift_claim_apply(token: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Called right after the recipient signs in with Google/Telegram on the
    claim page — applies the gift to whichever account they just authenticated
    as, regardless of whether that account's email matches recipient_email
    exactly (trusting unique-link possession + fresh auth over an email match)."""
    gift = db.query(GiftCard).filter(GiftCard.redemption_token == token).first()
    if not gift:
        raise HTTPException(status_code=404, detail="This gift link is invalid")
    if gift.redeemed:
        raise HTTPException(status_code=400, detail="This gift has already been claimed")

    now = datetime.now(timezone.utc)
    base = now if not current_user.membership_expires_at else max(now, current_user.membership_expires_at.replace(tzinfo=timezone.utc))
    current_user.membership_status = "active"
    current_user.membership_expires_at = base + timedelta(days=30 * gift.duration_months)
    if not current_user.phone and gift.recipient_phone:
        current_user.phone = gift.recipient_phone

    gift.applied_to_user_id = current_user.id
    gift.redeemed = True
    gift.redeemed_at = now
    db.commit()
    db.refresh(current_user)

    mailer.sync_member_to_brevo(db, current_user)
    mailer.track_event_async(current_user.email, "gift_claimed", {"duration_months": gift.duration_months})

    token_str = create_access_token(str(current_user.id))
    return TokenOut(access_token=token_str, user=UserOut.model_validate(current_user))
