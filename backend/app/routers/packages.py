from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core import ameriabank
from app.core import email as mailer
from app.core.config import settings
from app.core.deps import get_current_user
from app.core.payment_log import log_package_event
from app.database import get_db
from app.models.member_package import MemberPackage
from app.models.user import User
from app.routers.app_settings import get_packages_config
from app.schemas.package import (
    PackageOut, MemberPackageOut, MyPackagesOut, PackageCheckoutIn, PackageCheckoutOut,
)

router = APIRouter(prefix="/packages", tags=["packages"])

LANG_MAP = {"en": "en", "hy": "am", "ru": "ru"}
DOUBLE_SUBMIT_WINDOW_SECONDS = 60


def _card_holder_id(user_id: int) -> str:
    """Must match the deterministic id a member's binding was originally
    registered under (see SUPERSEDED app/core/billing.py::_card_holder_id,
    same formula) so a card bound under the old subscription flow still
    works for instant package charges."""
    return f"hc-user-{user_id}"


def _active_packages(db: Session) -> list:
    return sorted(
        (p for p in get_packages_config(db) if p.get("active", True)),
        key=lambda p: p.get("sortOrder", 0),
    )


def _find_package(db: Session, package_key: str) -> Optional[dict]:
    for p in _active_packages(db):
        if p["id"] == package_key:
            return p
    return None


def _credits_available(db: Session, user_id: int) -> int:
    now = datetime.now(timezone.utc)
    rows = db.query(MemberPackage).filter(
        MemberPackage.user_id == user_id,
        MemberPackage.credits_remaining > 0,
        MemberPackage.status.in_(ameriabank.PAID_STATUSES),
        or_(MemberPackage.expires_at.is_(None), MemberPackage.expires_at > now),
    ).all()
    return sum(r.credits_remaining for r in rows)


def _consume_event_credit(db: Session, user: User) -> MemberPackage:
    """Spends one credit from the member's earliest-expiring valid package
    (non-expiring packages are spent last, so a time-limited pack doesn't
    go to waste). Row-locked to avoid a double-spend race between two
    concurrent RSVP requests."""
    now = datetime.now(timezone.utc)
    row = (
        db.query(MemberPackage)
        .filter(
            MemberPackage.user_id == user.id,
            MemberPackage.credits_remaining > 0,
            MemberPackage.status.in_(ameriabank.PAID_STATUSES),
            or_(MemberPackage.expires_at.is_(None), MemberPackage.expires_at > now),
        )
        .order_by(MemberPackage.expires_at.is_(None), MemberPackage.expires_at.asc())
        .with_for_update()
        .first()
    )
    if not row:
        raise HTTPException(status_code=409, detail="You don't have any event credits left — buy a package to RSVP.")
    row.credits_remaining -= 1
    return row


@router.get("/public", response_model=list[PackageOut])
def list_public_packages(db: Session = Depends(get_db)):
    return _active_packages(db)


@router.get("/my", response_model=MyPackagesOut)
def my_packages(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = (
        db.query(MemberPackage)
        .filter(MemberPackage.user_id == current_user.id, MemberPackage.status.in_(ameriabank.PAID_STATUSES))
        .order_by(MemberPackage.created_at.desc())
        .all()
    )
    return MyPackagesOut(packages=rows, credits_available=_credits_available(db, current_user.id))


@router.post("/remove-card")
def remove_card(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Member-initiated equivalent of the old /payments/cancel-auto-renew —
    there's no more auto-renewal to cancel under the credit-package model,
    but a member can still choose to stop future purchases from
    instant-charging and go back through the redirect/checkout page."""
    if not current_user.binding_active:
        raise HTTPException(status_code=400, detail="No saved card on file")
    try:
        ameriabank.deactivate_binding(current_user.card_holder_id)
    except ameriabank.AmeriaBankError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Ameriabank: {exc}") from exc
    current_user.binding_active = False
    db.commit()
    return {"has_card": False}


def _credit_package(row: MemberPackage) -> None:
    """Grants credits from the row's own SNAPSHOTTED event_count/
    validity_days (set at checkout time), never from whatever amount the
    bank echoes back (test-mode amounts are deliberately wrong and must
    never leak into what a member is credited)."""
    row.credits_remaining = row.event_count
    row.expires_at = (
        datetime.now(timezone.utc) + timedelta(days=row.validity_days) if row.validity_days else None
    )


@router.post("/checkout", response_model=PackageCheckoutOut)
def checkout_package(
    body: PackageCheckoutIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not (settings.AMERIABANK_CLIENT_ID and settings.AMERIABANK_USERNAME and settings.AMERIABANK_PASSWORD):
        raise HTTPException(status_code=503, detail="Ameriabank is not configured")

    package = _find_package(db, body.package_key)
    if not package:
        raise HTTPException(status_code=404, detail="This package is no longer available — please refresh and try again.")

    recent_cutoff = datetime.now(timezone.utc) - timedelta(seconds=DOUBLE_SUBMIT_WINDOW_SECONDS)
    duplicate = (
        db.query(MemberPackage)
        .filter(
            MemberPackage.user_id == current_user.id,
            MemberPackage.package_key == body.package_key,
            MemberPackage.status == "started",
            MemberPackage.created_at >= recent_cutoff,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="A purchase for this package is already in progress — please wait a moment.")

    row = MemberPackage(
        user_id=current_user.id,
        package_key=package["id"],
        name_en=package["nameEn"], name_hy=package["nameHy"],
        event_count=package["eventCount"],
        credits_remaining=0,
        validity_days=package.get("validityDays"),
        amount=Decimal(str(package["price"])),
        currency=settings.AMERIABANK_CURRENCY,
        status="started",
    )
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

    charge = ameriabank.charge_amount(row.amount)
    # Ameriabank's hosted payment page HTML-escapes the Description field but
    # doesn't decode entities when rendering it back — a Unicode em dash here
    # showed up on the card literally as "&mdash;". Plain ASCII avoids that.
    description = f"Hasmik's Club package - {package['nameEn']} - {current_user.email or current_user.full_name}"

    if current_user.binding_active and current_user.card_holder_id:
        request_payload = {"OrderID": row.order_id, "Amount": float(charge), "CardHolderID": current_user.card_holder_id}
        try:
            resp = ameriabank.make_binding_payment(
                order_id=row.order_id, amount=charge, description=description,
                back_url=settings.AMERIABANK_PACKAGE_BACK_URL, card_holder_id=current_user.card_holder_id,
            )
        except ameriabank.AmeriaBankError as exc:
            row.status = "error"
            row.response_message = str(exc)
            db.commit()
            log_package_event(db, row.id, "make_binding_payment", request_payload=request_payload, response_payload={"error": str(exc)}, success=False)
            return PackageCheckoutOut(mode="instant", success=False, message="Could not reach Ameriabank — please try again shortly.")

        ok = ameriabank.is_success_code(resp.get("ResponseCode"))
        log_package_event(db, row.id, "make_binding_payment", request_payload=request_payload, response_payload=resp, success=ok)
        row.response_code = resp.get("ResponseCode")
        row.response_message = resp.get("ResponseMessage")
        row.card_number = resp.get("CardNumber")
        row.approval_code = resp.get("ApprovalCode")
        row.rrn = resp.get("rrn")
        row.payment_id = resp.get("PaymentID")
        row.status = ameriabank.status_from_details(resp) if ok else "declined"
        if ok:
            _credit_package(row)
            current_user.membership_status = "active"
            db.commit()
            mailer.track_event_async(current_user.email, "package_purchased", {"package": package["nameEn"], "amount": float(row.amount)})
            mailer.sync_member_to_brevo(db, current_user)
            return PackageCheckoutOut(mode="instant", success=True)
        db.commit()
        return PackageCheckoutOut(mode="instant", success=False, message=row.response_message or "Payment was declined.")

    card_holder_id = _card_holder_id(current_user.id)
    init_request = {"OrderID": row.order_id, "Amount": float(charge), "CardHolderID": card_holder_id}
    try:
        resp = ameriabank.init_payment(
            order_id=row.order_id, amount=charge, description=description,
            back_url=settings.AMERIABANK_PACKAGE_BACK_URL, card_holder_id=card_holder_id,
        )
    except ameriabank.AmeriaBankError as exc:
        row.status = "error"
        row.response_message = str(exc)
        db.commit()
        log_package_event(db, row.id, "init_payment", request_payload=init_request, response_payload={"error": str(exc)}, success=False)
        raise HTTPException(status_code=502, detail="Could not start payment — please try again shortly") from exc

    init_ok = resp.get("ResponseCode") == 1
    log_package_event(db, row.id, "init_payment", request_payload=init_request, response_payload=resp, success=init_ok)
    if not init_ok:
        row.status = "error"
        row.response_message = resp.get("ResponseMessage")
        db.commit()
        raise HTTPException(status_code=502, detail=resp.get("ResponseMessage") or "Payment initialization failed")

    row.payment_id = resp.get("PaymentID")
    db.commit()
    mailer.track_event_async(current_user.email, "package_checkout_started", {"package": package["nameEn"], "amount": float(row.amount)})

    lang = LANG_MAP.get(body.lang_pref or current_user.lang_pref, "en")
    return PackageCheckoutOut(mode="redirect", url=ameriabank.payment_page_url(row.payment_id, lang))


@router.api_route("/callback", methods=["GET", "POST"])
async def package_callback(request: Request, db: Session = Depends(get_db)):
    """BackURL target — only reached by the redirect (no-bound-card) path;
    the instant-charge path resolves synchronously inside /checkout. Same
    verify-before-trust pattern as payments.py/gift.py's callbacks."""
    if request.method == "POST":
        params = dict(await request.form())
    else:
        params = dict(request.query_params)

    payment_id = params.get("paymentID") or params.get("PaymentID")
    order_id_raw = params.get("orderID") or params.get("OrderID")

    row = None
    if payment_id:
        row = db.query(MemberPackage).filter(MemberPackage.payment_id == payment_id).first()
    if not row and order_id_raw:
        try:
            row = db.query(MemberPackage).filter(MemberPackage.order_id == int(order_id_raw)).first()
        except ValueError:
            row = None

    outcome = "failed"
    if row and row.payment_id:
        verify_request = {"PaymentID": row.payment_id}
        try:
            details = ameriabank.get_payment_details(row.payment_id)
        except ameriabank.AmeriaBankError as exc:
            details = None
            log_package_event(db, row.id, "verify_callback", request_payload=verify_request, response_payload={"error": str(exc)}, success=False)

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
            if is_success and user:
                _credit_package(row)
                user.membership_status = "active"
                if details.get("BindingID"):
                    user.card_holder_id = _card_holder_id(user.id)
                    user.binding_active = True
                outcome = "success"
            db.commit()
            log_package_event(db, row.id, "verify_callback", request_payload=verify_request, response_payload=details, success=is_success)

            if user and not was_already_paid:
                if is_success:
                    mailer.track_event_async(user.email, "package_purchased", {"package": row.name_en, "amount": float(row.amount)})
                    mailer.sync_member_to_brevo(db, user)
                else:
                    mailer.track_event_async(user.email, "package_checkout_failed", {"response_message": row.response_message})

    target = settings.AMERIABANK_PACKAGE_SUCCESS_URL if outcome == "success" else settings.AMERIABANK_PACKAGE_CANCEL_URL
    return RedirectResponse(url=f"{target}?package={outcome}")
