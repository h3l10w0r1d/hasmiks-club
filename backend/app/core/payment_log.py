import json
from typing import Optional

from sqlalchemy.orm import Session

from app.models.ameria_payment_log import AmeriaPaymentLog


def log_payment_event(
    db: Session,
    payment_row_id: int,
    event: str,
    *,
    request_payload: Optional[dict] = None,
    response_payload=None,
    success: bool,
) -> None:
    """Record one Ameriabank API interaction for a payment.

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
