from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


def log(
    db: Session,
    action: str,
    admin_id: int | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    details: str | None = None,
) -> None:
    entry = AuditLog(
        admin_id=admin_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.add(entry)
    db.flush()  # write in same transaction as the triggering operation
