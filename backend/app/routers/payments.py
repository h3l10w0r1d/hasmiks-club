from decimal import Decimal
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core import ameriabank
from app.core import email as mailer
from app.core.billing import MEMBERSHIP_PERIOD_DAYS, _card_holder_id
from app.core.config import settings
from app.core.deps import get_current_user
from app.core.payment_log import log_payment_event
from app.database import get_db
from app.models.ameria_payment import AmeriaPayment
from app.models.user import User

router = APIRouter(prefix="/payments", tags=["payments"])

LANG_MAP = {"en": "en", "hy": "am", "ru": "ru"}


@router.post("/create-checkout")
def create_checkout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not (settings.AMERIABANK_CLIENT_ID and settings.AMERIABANK_USERNAME and settings.AMERIABANK_PASSWORD):
        raise HTTPException(status_code=503, detail="Ameriabank is not configured")

    amount = Decimal(str(settings.AMERIABANK_TEST_AMOUNT if settings.AMERIABANK_TEST_MODE else settings.AMERIABANK_MEMBERSHIP_AMOUNT))

    row = AmeriaPayment(user_id=current_user.id, amount=amount, currency=settings.AMERIABANK_CURRENCY, status="started")
    db.add(row)
    db.commit()
    db.refresh(row)

    try:
        row.order_id = ameriabank.next_order_id(db)
    except ameriabank.AmeriaBankError as exc:
        row.status = "error"
        row.response_message = str(exc)
        db.commit()
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    db.commit()

    card_holder_id = _card_holder_id(current_user.id)
    init_request = {"OrderID": row.order_id, "Amount": float(amount), "Currency": row.currency, "BackURL": settings.AMERIABANK_BACK_URL, "CardHolderID": card_holder_id}
    try:
        resp = ameriabank.init_payment(
            order_id=row.order_id,
            amount=amount,
            description=f"Hasmik's Club membership — {current_user.email or current_user.full_name}",
            back_url=settings.AMERIABANK_BACK_URL,
            card_holder_id=card_holder_id,
        )
    except ameriabank.AmeriaBankError as exc:
        row.status = "error"
        row.response_message = str(exc)
        db.commit()
        log_payment_event(db, row.id, "init_payment", request_payload=init_request, response_payload={"error": str(exc)}, success=False)
        raise HTTPException(status_code=502, detail="Could not start payment — please try again shortly") from exc

    # InitPayment uses an INTEGER response code — successful == 1 (distinct from every other endpoint's "00" string).
    init_ok = resp.get("ResponseCode") == 1
    log_payment_event(db, row.id, "init_payment", request_payload=init_request, response_payload=resp, success=init_ok)
    if not init_ok:
        row.status = "error"
        row.response_message = resp.get("ResponseMessage")
        db.commit()
        raise HTTPException(status_code=502, detail=resp.get("ResponseMessage") or "Payment initialization failed")

    row.payment_id = resp.get("PaymentID")
    db.commit()

    mailer.track_event_async(current_user.email, "checkout_started", {"amount": float(amount)})

    lang = LANG_MAP.get(current_user.lang_pref, "en")
    return {"url": ameriabank.payment_page_url(row.payment_id, lang)}


@router.api_route("/callback", methods=["GET", "POST"])
async def payment_callback(request: Request, db: Session = Depends(get_db)):
    """BackURL target — Ameriabank sends the buyer's browser here after payment.

    We never trust the redirect's query/form params as proof of payment; we
    always re-verify server-to-server via GetPaymentDetails before touching
    membership_status.
    """
    if request.method == "POST":
        params = dict(await request.form())
    else:
        params = dict(request.query_params)

    payment_id = params.get("paymentID") or params.get("PaymentID")
    order_id_raw = params.get("orderID") or params.get("OrderID")

    row = None
    if payment_id:
        row = db.query(AmeriaPayment).filter(AmeriaPayment.payment_id == payment_id).first()
    if not row and order_id_raw:
        try:
            row = db.query(AmeriaPayment).filter(AmeriaPayment.order_id == int(order_id_raw)).first()
        except ValueError:
            row = None

    outcome = "failed"
    if row and row.payment_id:
        verify_request = {"PaymentID": row.payment_id}
        try:
            details = ameriabank.get_payment_details(row.payment_id)
        except ameriabank.AmeriaBankError as exc:
            details = None
            log_payment_event(db, row.id, "verify_callback", request_payload=verify_request, response_payload={"error": str(exc)}, success=False)

        if details:
            was_already_paid = row.status in ameriabank.PAID_STATUSES
            row.response_code = details.get("ResponseCode")
            row.response_message = details.get("ResponseMessage")
            row.card_number = details.get("CardNumber")
            row.approval_code = details.get("ApprovalCode")
            row.rrn = details.get("rrn")

            row.status = ameriabank.status_from_details(details)
            is_success = ameriabank.is_paid(details)
            user = db.query(User).filter(User.id == row.user_id).first()
            if is_success:
                if user:
                    user.membership_status = "active"
                    # A real subscription payment supersedes any gift-granted
                    # countdown — clear it so the expiry job never lapses a
                    # now-genuinely-paying member.
                    user.membership_expires_at = None
                    user.next_billing_date = datetime.now(timezone.utc) + timedelta(days=MEMBERSHIP_PERIOD_DAYS)
                    user.renewal_attempts = 0
                    user.card_required_by = None
                    # BindingID only comes back if the bank actually registered
                    # the card under our CardHolderID — some cards/issuers don't
                    # support it. If it's missing, this payment still counts
                    # (membership is active) but auto-renewal silently can't
                    # happen, same as an existing member with no card on file.
                    if details.get("BindingID"):
                        user.card_holder_id = _card_holder_id(user.id)
                        user.binding_active = True
                outcome = "success"
            db.commit()
            log_payment_event(db, row.id, "verify_callback", request_payload=verify_request, response_payload=details, success=is_success)

            # Ameriabank's redirect can legitimately hit this callback more
            # than once for the same payment (double-click, back/forward,
            # a defensive retry) — the DB write above is naturally idempotent,
            # but firing payment_succeeded/sync every time would double-count
            # revenue events in Brevo. Only fire on the actual transition into
            # a paid state.
            if user and not was_already_paid:
                if is_success:
                    mailer.track_event_async(user.email, "payment_succeeded", {"amount": float(row.amount), "order_id": row.order_id})
                    mailer.sync_member_to_brevo(db, user)
                else:
                    mailer.track_event_async(user.email, "payment_failed", {"response_message": row.response_message})

    target = settings.AMERIABANK_SUCCESS_URL if outcome == "success" else settings.AMERIABANK_CANCEL_URL
    return RedirectResponse(url=f"{target}?payment={outcome}")


@router.get("/billing")
def get_billing_info(current_user: User = Depends(get_current_user)):
    """Everything the dashboard billing section needs to render — whether
    auto-renew is on, when the next charge is, and whether a card-migration
    deadline is looming for members who predate this feature."""
    return {
        "has_card": bool(current_user.card_holder_id),
        "auto_renew": current_user.binding_active,
        "next_billing_date": current_user.next_billing_date,
        "membership_status": current_user.membership_status,
        "card_required_by": current_user.card_required_by,
    }


@router.post("/cancel-auto-renew")
def cancel_auto_renew(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Member-initiated — stops future renewal charges but does NOT touch
    membership_status, so access continues until the already-paid period
    (next_billing_date) actually runs out, same as cancelling any subscription."""
    if not current_user.binding_active:
        raise HTTPException(status_code=400, detail="Auto-renew is not currently active")
    try:
        ameriabank.deactivate_binding(current_user.card_holder_id)
    except ameriabank.AmeriaBankError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Ameriabank: {exc}") from exc
    current_user.binding_active = False
    db.commit()
    return {"auto_renew": False}
