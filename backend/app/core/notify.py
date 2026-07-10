from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.core.push import send_push_async


def push(
    db: Session,
    user_id: int,
    type: str,
    text: str,
    link: str | None = None,
) -> None:
    db.add(Notification(user_id=user_id, type=type, text=text, link=link))
    db.flush()
    send_push_async(user_id, "Hasmik's Club", text, link)
