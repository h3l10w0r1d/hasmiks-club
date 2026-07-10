"""Recurring membership billing — renewal charges and the failed-payment
dunning cycle, both driven by the same daily scheduled job (see main.py).

Two situations feed into the same cycle:
  1. A real renewal is due (next_billing_date has passed) for a member with
     an active Ameriabank card binding — charge their saved card.
  2. An existing member who predates this feature never added a card, and
     their one-time migration deadline (card_required_by) has passed — there's
     no card to charge, so every check just counts as an automatic failure
     until they add one, using the exact same retry/lapse timeline.
"""
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.core import ameriabank
from app.core import email as mailer
from app.core.config import settings
from app.core.payment_log import log_payment_event
from app.models.ameria_payment import AmeriaPayment
from app.models.user import User

logger = logging.getLogger(__name__)

MEMBERSHIP_PERIOD_DAYS = 30
RETRY_INTERVAL_DAYS = 3
MAX_RENEWAL_ATTEMPTS = 3  # ~9 days of retrying (3, 3, 3) before lapsing


def _card_holder_id(user_id: int) -> str:
    """Must match payments.py's _card_holder_id exactly — both sides need to
    agree on the same deterministic ID for a given user's binding."""
    return f"hc-user-{user_id}"


def _membership_amount() -> Decimal:
    return Decimal(str(settings.AMERIABANK_TEST_AMOUNT if settings.AMERIABANK_TEST_MODE else settings.AMERIABANK_MEMBERSHIP_AMOUNT))


def process_due_members(db) -> None:
    now = datetime.now(timezone.utc)

    # Kick any existing member whose card-migration deadline just passed into
    # the same dunning cycle as a real failed renewal — from this point on
    # they're indistinguishable from someone whose card started failing.
    overdue_card = db.query(User).filter(
        User.membership_status == "active",
        User.card_required_by.isnot(None),
        User.card_required_by <= now,
        User.binding_active == False,  # noqa: E712
    ).all()
    for user in overdue_card:
        user.next_billing_date = now
        user.card_required_by = None
    if overdue_card:
        db.commit()

    due = db.query(User).filter(
        User.membership_status.in_(["active", "past_due"]),
        User.next_billing_date.isnot(None),
        User.next_billing_date <= now,
    ).all()
    for user in due:
        _process_one(db, user, now)


def _process_one(db, user: User, now: datetime) -> None:
    if user.binding_active and user.card_holder_id:
        _attempt_charge(db, user, now)
    else:
        # No card on file at all (never bound one, or it was cleared after a
        # prior lapse) — nothing to charge, so this is an automatic failure
        # that still advances the same retry countdown.
        _record_failure(db, user, now)


def _attempt_charge(db, user: User, now: datetime) -> None:
    amount = _membership_amount()
    row = AmeriaPayment(user_id=user.id, amount=amount, currency=settings.AMERIABANK_CURRENCY, status="started")
    db.add(row)
    db.commit()
    db.refresh(row)

    try:
        row.order_id = ameriabank.next_order_id(db)
    except ameriabank.AmeriaBankError as exc:
        row.status = "error"
        row.response_message = str(exc)
        db.commit()
        _record_failure(db, user, now)
        return
    db.commit()

    request_payload = {"OrderID": row.order_id, "Amount": float(amount), "CardHolderID": user.card_holder_id}
    try:
        resp = ameriabank.make_binding_payment(
            order_id=row.order_id,
            amount=amount,
            description=f"Hasmik's Club membership renewal — {user.email or user.full_name}",
            back_url=settings.AMERIABANK_BACK_URL,
            card_holder_id=user.card_holder_id,
        )
    except ameriabank.AmeriaBankError as exc:
        row.status = "error"
        row.response_message = str(exc)
        db.commit()
        log_payment_event(db, row.id, "make_binding_payment", request_payload=request_payload, response_payload={"error": str(exc)}, success=False)
        _record_failure(db, user, now)
        return

    ok = ameriabank.is_success_code(resp.get("ResponseCode"))
    log_payment_event(db, row.id, "make_binding_payment", request_payload=request_payload, response_payload=resp, success=ok)
    row.response_code = resp.get("ResponseCode")
    row.response_message = resp.get("ResponseMessage")
    row.card_number = resp.get("CardNumber")
    row.approval_code = resp.get("ApprovalCode")
    row.rrn = resp.get("rrn")
    row.payment_id = resp.get("PaymentID")
    row.status = ameriabank.status_from_details(resp) if ok else "declined"
    db.commit()

    if ok:
        _record_success(db, user, now, amount, row.order_id)
    else:
        _record_failure(db, user, now)


def _record_success(db, user: User, now: datetime, amount: Decimal, order_id: int) -> None:
    user.membership_status = "active"
    user.next_billing_date = now + timedelta(days=MEMBERSHIP_PERIOD_DAYS)
    user.renewal_attempts = 0
    db.commit()
    mailer.track_event_async(user.email, "renewal_succeeded", {"amount": float(amount), "order_id": order_id})
    mailer.sync_member_to_brevo(db, user)
    if user.email:
        mailer.send_renewal_succeeded(user.email, user.full_name, float(amount))


def _record_failure(db, user: User, now: datetime) -> None:
    user.renewal_attempts += 1
    if user.renewal_attempts >= MAX_RENEWAL_ATTEMPTS:
        user.membership_status = "inactive"
        user.next_billing_date = None
        user.binding_active = False
        db.commit()
        mailer.track_event_async(user.email, "membership_lapsed")
        mailer.sync_member_to_brevo(db, user)
        if user.email:
            mailer.send_membership_lapsed(user.email, user.full_name)
    else:
        user.membership_status = "past_due"
        user.next_billing_date = now + timedelta(days=RETRY_INTERVAL_DAYS)
        db.commit()
        attempts_left = MAX_RENEWAL_ATTEMPTS - user.renewal_attempts
        mailer.track_event_async(user.email, "renewal_failed", {"attempts_left": attempts_left})
        if user.email:
            mailer.send_renewal_failed(user.email, user.full_name, attempts_left)
