from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.content import ContentItem, MemberContent
from app.models.user import User
from app.schemas.content import ContentOut
from app.core.deps import get_current_user

router = APIRouter(prefix="/content", tags=["content"])


def _serialize(item: ContentItem, unlocked_ids: set) -> ContentOut:
    return ContentOut(
        id=item.id,
        type=item.type,
        title=item.title,
        title_hy=item.title_hy,
        description=item.description,
        description_hy=item.description_hy,
        file_url=item.file_url if item.id in unlocked_ids else None,
        cover_url=item.cover_url,
        published_at=item.published_at,
        is_unlocked=item.id in unlocked_ids,
    )


@router.get("/", response_model=List[ContentOut])
def list_content(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """All content items with lock state — inactive members see locked items."""
    items = db.query(ContentItem).order_by(ContentItem.published_at.desc()).all()
    unlocked = {
        mc.content_id
        for mc in db.query(MemberContent).filter(MemberContent.user_id == current_user.id).all()
    }
    return [_serialize(i, unlocked) for i in items]


@router.get("/my/library", response_model=List[ContentOut])
def my_library(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Only content unlocked for this user (any membership status)."""
    unlocked_ids = {mc.content_id for mc in current_user.unlocked_content}
    if not unlocked_ids:
        return []
    items = (
        db.query(ContentItem)
        .filter(ContentItem.id.in_(unlocked_ids))
        .order_by(ContentItem.published_at.desc())
        .all()
    )
    return [_serialize(i, unlocked_ids) for i in items]


@router.get("/{content_id}", response_model=ContentOut)
def get_content(content_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    unlocked = db.query(MemberContent).filter(
        MemberContent.user_id == current_user.id, MemberContent.content_id == content_id
    ).first()
    return _serialize(item, {content_id} if unlocked else set())
