from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core import ameriabank
from app.core.config import settings
from app.core.deps import get_current_user
from app.database import get_db
from app.models.ameria_payment import AmeriaPayment
from app.models.user import User

router = APIRouter(prefix="/payments", tags=["payments"])

LANG_MAP = {"en": "en", "hy": "am", "ru": "ru"}


def _next_order_id(row_id: int) -> int:
    order_id = settings.AMERIABANK_ORDER_ID_START + row_id - 1
    if settings.AMERIABANK_TEST_MODE and order_id > settings.AMERIABANK_ORDER_ID_END:
        raise HTTPException(
            status_code=503,
            detail=(
                "Ameriabank test OrderID range exhausted — request a new range from "
                "the bank or set AMERIABANK_TEST_MODE=false once credentials go live."
            ),
        )
    return order_id


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

    row.order_id = _next_order_id(row.id)
    db.commit()

    try:
        resp = ameriabank.init_payment(
            order_id=row.order_id,
            amount=amount,
            description=f"Hasmik's Club membership — {current_user.email}",
            back_url=settings.AMERIABANK_BACK_URL,
        )
    except ameriabank.AmeriaBankError as exc:
        row.status = "error"
        row.response_message = str(exc)
        db.commit()
        raise HTTPException(status_code=502, detail="Could not start payment — please try again shortly") from exc

    # InitPayment uses an INTEGER response code — successful == 1 (distinct from every other endpoint's "00" string).
    if resp.get("ResponseCode") != 1:
        row.status = "error"
        row.response_message = resp.get("ResponseMessage")
        db.commit()
        raise HTTPException(status_code=502, detail=resp.get("ResponseMessage") or "Payment initialization failed")

    row.payment_id = resp.get("PaymentID")
    db.commit()

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
        try:
            details = ameriabank.get_payment_details(row.payment_id)
        except ameriabank.AmeriaBankError:
            details = None

        if details:
            row.response_code = details.get("ResponseCode")
            row.response_message = details.get("ResponseMessage")
            row.card_number = details.get("CardNumber")
            row.approval_code = details.get("ApprovalCode")
            row.rrn = details.get("rrn")

            # every non-InitPayment endpoint uses the STRING code — successful == "00" (Table 1)
            if details.get("ResponseCode") == "00":
                row.status = "deposited"
                user = db.query(User).filter(User.id == row.user_id).first()
                if user:
                    user.membership_status = "active"
                outcome = "success"
            else:
                row.status = "declined"
            db.commit()

    target = settings.AMERIABANK_SUCCESS_URL if outcome == "success" else settings.AMERIABANK_CANCEL_URL
    return RedirectResponse(url=f"{target}?payment={outcome}")
