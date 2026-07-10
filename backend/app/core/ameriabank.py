"""Thin REST client for Ameriabank vPOS 3.1.

All requests are plain JSON POSTs to {AMERIABANK_BASE_URL}/api/VPOS/{Function}.
Two different "success" conventions are used by the bank's API:
  - InitPayment: ResponseCode is an INTEGER, successful == 1
  - every other function: ResponseCode is a STRING, successful == "00" (Table 1)
Callers must check the right one — this module does not normalize it away,
since callers need the raw ResponseMessage for error display either way.
"""
from typing import Optional

import httpx

from app.core.config import settings


class AmeriaBankError(Exception):
    """Raised on network failure or a non-JSON/non-200 response."""


def _post(path: str, payload: dict) -> dict:
    url = f"{settings.AMERIABANK_BASE_URL}/api/VPOS/{path}"
    try:
        resp = httpx.post(url, json=payload, timeout=20.0)
    except httpx.HTTPError as exc:
        raise AmeriaBankError(f"Network error calling {path}: {exc}") from exc

    if resp.status_code != 200:
        raise AmeriaBankError(f"{path} returned HTTP {resp.status_code}: {resp.text[:300]}")
    try:
        return resp.json()
    except ValueError as exc:
        raise AmeriaBankError(f"{path} returned a non-JSON response: {resp.text[:300]}") from exc


def _credentials() -> dict:
    return {
        "Username": settings.AMERIABANK_USERNAME,
        "Password": settings.AMERIABANK_PASSWORD,
    }


def init_payment(*, order_id: int, amount: float, description: str, back_url: str, currency: Optional[str] = None, card_holder_id: Optional[str] = None) -> dict:
    payload = {
        "ClientID": settings.AMERIABANK_CLIENT_ID,
        **_credentials(),
        "OrderID": order_id,
        "Amount": float(amount),
        "Description": description,
        "BackURL": back_url,
        "Currency": currency or settings.AMERIABANK_CURRENCY,
    }
    if card_holder_id:
        # Registers this payment's card under card_holder_id once the buyer
        # completes it — see "Binding Transactions" in the vPOS docs. Every
        # later renewal charges that same card via make_binding_payment()
        # with no redirect and no re-entering card details.
        payload["CardHolderID"] = card_holder_id
    return _post("InitPayment", payload)


def get_payment_details(payment_id: str) -> dict:
    return _post("GetPaymentDetails", {"PaymentID": payment_id, **_credentials()})


def confirm_payment(payment_id: str, amount: float) -> dict:
    return _post("ConfirmPayment", {"PaymentID": payment_id, **_credentials(), "Amount": float(amount)})


def cancel_payment(payment_id: str) -> dict:
    return _post("CancelPayment", {"PaymentID": payment_id, **_credentials()})


def refund_payment(payment_id: str, amount: float) -> dict:
    return _post("RefundPayment", {"PaymentID": payment_id, **_credentials(), "Amount": float(amount)})


def payment_page_url(payment_id: str, lang: str = "en") -> str:
    return f"{settings.AMERIABANK_BASE_URL}/Payments/Pay?id={payment_id}&lang={lang}"


# PaymentType values shared by the binding functions below (per vPOS docs' PaymentsEnum)
_BINDING_PAYMENT_TYPE = 6


def make_binding_payment(*, order_id: int, amount: float, description: str, back_url: str, card_holder_id: str, currency: Optional[str] = None) -> dict:
    """Charge a previously-bound card directly — no redirect, no card entry.
    Used for membership renewals once the first payment has established a
    binding for this card_holder_id."""
    payload = {
        "ClientID": settings.AMERIABANK_CLIENT_ID,
        **_credentials(),
        "OrderID": order_id,
        "Amount": float(amount),
        "Description": description,
        "BackURL": back_url,
        "Currency": currency or settings.AMERIABANK_CURRENCY,
        "CardHolderID": card_holder_id,
        "PaymentType": _BINDING_PAYMENT_TYPE,
    }
    return _post("MakeBindingPayment", payload)


def get_bindings() -> dict:
    """Every bound card on the whole merchant account (the request has no
    CardHolderID filter per the docs — each entry in the response's
    CardBindingFileds list carries its own CardHolderID to match against)."""
    return _post("GetBindings", {
        "ClientID": settings.AMERIABANK_CLIENT_ID,
        **_credentials(),
        "PaymentType": _BINDING_PAYMENT_TYPE,
    })


def activate_binding(card_holder_id: str) -> dict:
    return _post("ActivateBinding", {
        "ClientID": settings.AMERIABANK_CLIENT_ID,
        **_credentials(),
        "PaymentType": _BINDING_PAYMENT_TYPE,
        "CardHolderID": card_holder_id,
    })


def deactivate_binding(card_holder_id: str) -> dict:
    return _post("DeactivateBinding", {
        "ClientID": settings.AMERIABANK_CLIENT_ID,
        **_credentials(),
        "PaymentType": _BINDING_PAYMENT_TYPE,
        "CardHolderID": card_holder_id,
    })


def is_success_code(response_code) -> bool:
    """Table 1's "successful" code is "00", but the bank sometimes formats it
    as "00 : Payment Successfully Completed" rather than a bare "00" (seen in
    the GetTransactionList/SOAP sample) — an exact `== "00"` match silently
    fails on a real success. Use this for ConfirmPayment/CancelPayment/
    RefundPayment responses, which don't carry an OrderStatus to fall back on."""
    return str(response_code or "").strip().startswith("00")


# Table 2 (Payment State Values). CRITICAL: the live API returns OrderStatus as
# a STRING ("2"), not the integer the docs imply — an `x in {2,5}` int check
# silently fails on a real payment, marking it declined. status_from_details()
# coerces it, and falls back to the named PaymentState ("payment_deposited").
_ORDER_STATUS_LABELS = {0: "started", 1: "approved", 2: "deposited", 3: "void", 4: "refunded", 5: "autoauthorized", 6: "declined"}

# For single-step (immediate-capture) membership payments, "the buyer paid"
# means deposited or autoauthorized-via-ACS — NOT merely "approved" (a two-step
# hold that hasn't been captured). Matches the proven reference integration.
PAID_STATUSES = {"deposited", "autoauthorized"}


def status_from_details(details: dict) -> str:
    """Normalize a GetPaymentDetails response to a plain status label
    (started/approved/deposited/void/refunded/autoauthorized/declined),
    handling OrderStatus arriving as either an int or a string, and falling
    back to the named PaymentState field."""
    raw = details.get("OrderStatus")
    try:
        label = _ORDER_STATUS_LABELS.get(int(raw))
        if label:
            return label
    except (TypeError, ValueError):
        pass
    state = str(details.get("PaymentState") or "").strip().lower()
    if state.startswith("payment_"):
        state = state[len("payment_"):]
    return state or "unknown"


def is_paid(details: dict) -> bool:
    """True if a GetPaymentDetails response shows the buyer actually paid."""
    return status_from_details(details) in PAID_STATUSES


def next_order_id(db) -> int:
    """Next Ameriabank OrderID, unique across membership payments, one-time
    guest tickets, AND gift cards — Ameriabank requires order IDs to be
    globally unique regardless of which local table they're tracked in, so
    this can't just be "highest row id in one table + offset" once several
    tables draw from the same namespace."""
    from sqlalchemy import func as sa_func
    from app.models.ameria_payment import AmeriaPayment
    from app.models.guest_ticket import GuestTicket
    from app.models.gift_card import GiftCard

    max_membership = db.query(sa_func.max(AmeriaPayment.order_id)).scalar() or 0
    max_guest = db.query(sa_func.max(GuestTicket.order_id)).scalar() or 0
    max_gift = db.query(sa_func.max(GiftCard.order_id)).scalar() or 0
    next_id = max(max_membership, max_guest, max_gift, settings.AMERIABANK_ORDER_ID_START - 1) + 1
    if settings.AMERIABANK_TEST_MODE and next_id > settings.AMERIABANK_ORDER_ID_END:
        raise AmeriaBankError(
            "Ameriabank test OrderID range exhausted — request a new range from "
            "the bank or set AMERIABANK_TEST_MODE=false once credentials go live."
        )
    return next_id
