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


def init_payment(*, order_id: int, amount: float, description: str, back_url: str, currency: Optional[str] = None) -> dict:
    payload = {
        "ClientID": settings.AMERIABANK_CLIENT_ID,
        **_credentials(),
        "OrderID": order_id,
        "Amount": float(amount),
        "Description": description,
        "BackURL": back_url,
        "Currency": currency or settings.AMERIABANK_CURRENCY,
    }
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
