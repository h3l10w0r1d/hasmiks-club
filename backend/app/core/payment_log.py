import json
from typing import Optional

from sqlalchemy.orm import Session

from app.models.ameria_payment_log import AmeriaPaymentLog
from app.models.guest_ticket_log import GuestTicketLog
from app.models.gift_card_log import GiftCardLog


def log_payment_event(
    db: Session,
    payment_row_id: int,
    event: str,
    *,
    request_payload: Optional[dict] = None,
    response_payload=None,
    success: bool,
) -> None:
    """Record one Ameriabank API interaction for a membership payment.

    `request_payload` should be a minimal, informative dict built by the
    caller for debugging — never the literal payload sent to the bank, so
    there's no risk of accidentally persisting ClientID/Username/Password.
    """
    db.add(AmeriaPaymentLog(
        payment_row_id=payment_row_id,
        event=event,
        success=success,
        request_payload=json.dumps(request_payload, default=str) if request_payload else None,
        response_payload=json.dumps(response_payload, default=str) if response_payload is not None else None,
    ))
    db.commit()


def log_guest_ticket_event(
    db: Session,
    ticket_row_id: int,
    event: str,
    *,
    request_payload: Optional[dict] = None,
    response_payload=None,
    success: bool,
) -> None:
    """Same as log_payment_event, but for one-time guest tickets — a
    separate table since guest_tickets.id is an independent sequence from
    ameria_payments.id, not something log_payment_event's FK can point at."""
    db.add(GuestTicketLog(
        ticket_row_id=ticket_row_id,
        event=event,
        success=success,
        request_payload=json.dumps(request_payload, default=str) if request_payload else None,
        response_payload=json.dumps(response_payload, default=str) if response_payload is not None else None,
    ))
    db.commit()


def log_gift_event(
    db: Session,
    gift_card_id: int,
    event: str,
    *,
    request_payload: Optional[dict] = None,
    response_payload=None,
    success: bool,
) -> None:
    """Same as log_payment_event/log_guest_ticket_event, but for gift cards."""
    db.add(GiftCardLog(
        gift_card_id=gift_card_id,
        event=event,
        success=success,
        request_payload=json.dumps(request_payload, default=str) if request_payload else None,
        response_payload=json.dumps(response_payload, default=str) if response_payload is not None else None,
    ))
    db.commit()
