"""Web Push (browser push notifications) via VAPID — no third-party push
service, talks directly to whatever push service each browser vendor uses
(FCM for Chrome, Mozilla's service for Firefox, etc.) through pywebpush."""
import logging
import threading

from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)


def _send_one(db: Session, sub: PushSubscription, payload: str) -> None:
    try:
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            },
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
        )
    except WebPushException as exc:
        status_code = exc.response.status_code if exc.response is not None else None
        if status_code in (404, 410):
            # Browser unsubscribed or the subscription expired — the endpoint
            # is permanently dead, so stop trying it instead of erroring on
            # every future notification.
            db.query(PushSubscription).filter(PushSubscription.id == sub.id).delete()
            db.commit()
        else:
            logger.warning("Web push failed for subscription %s: %s", sub.id, exc)
    except Exception:
        logger.exception("Web push failed for subscription %s", sub.id)


def _send_all(user_id: int, payload: str) -> None:
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        subs = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
        for sub in subs:
            _send_one(db, sub, payload)
    finally:
        db.close()


def send_push_async(user_id: int, title: str, body: str, link: str | None = None) -> None:
    if not (settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY):
        return  # not configured — silently skip, in-app notification row already covers this
    import json

    payload = json.dumps({"title": title, "body": body, "link": link or "/dashboard"})
    threading.Thread(target=_send_all, args=(user_id, payload), daemon=True).start()
