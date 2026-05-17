from sqlalchemy.orm import Session
from app.models.notification import Notification


def push(
    db: Session,
    user_id: int,
    type: str,
    text: str,
    link: str | None = None,
) -> None:
    db.add(Notification(user_id=user_id, type=type, text=text, link=link))
    db.flush()
