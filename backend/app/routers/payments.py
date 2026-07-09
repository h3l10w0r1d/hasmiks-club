from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core import ameriabank
from app.core import email as mailer
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

    init_request = {"OrderID": row.order_id, "Amount": float(amount), "Currency": row.currency, "BackURL": settings.AMERIABANK_BACK_URL}
    try:
        resp = ameriabank.init_payment(
            order_id=row.order_id,
            amount=amount,
            description=f"Hasmik's Club membership — {current_user.email or current_user.full_name}",
            back_url=settings.AMERIABANK_BACK_URL,
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
