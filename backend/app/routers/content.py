from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.content import ContentItem, MemberContent
from app.models.user import User
from app.schemas.content import ContentCreate, ContentOut
from app.core.deps import get_current_user, get_current_active_member

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
def list_content(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = db.query(ContentItem).order_by(ContentItem.published_at.desc()).all()
    unlocked = {mc.content_id for mc in db.query(MemberContent).filter(MemberContent.user_id == current_user.id).all()}
    return [_serialize(i, unlocked) for i in items]


@router.get("/{content_id}", response_model=ContentOut)
def get_content(
    content_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    unlocked = db.query(MemberContent).filter(
        MemberContent.user_id == current_user.id,
        MemberContent.content_id == content_id,
    ).first()
    return _serialize(item, {content_id} if unlocked else set())


@router.post("/", response_model=ContentOut, status_code=status.HTTP_201_CREATED)
def create_content(payload: ContentCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = ContentItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize(item, set())


@router.post("/{content_id}/unlock/{user_id}", response_model=ContentOut)
def unlock_for_member(
    content_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    item = db.query(ContentItem).filter(ContentItem.id == content_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")
    exists = db.query(MemberContent).filter(
        MemberContent.user_id == user_id, MemberContent.content_id == content_id
    ).first()
    if not exists:
        db.add(MemberContent(user_id=user_id, content_id=content_id))
        db.commit()
    return _serialize(item, {content_id})


@router.get("/my/library", response_model=List[ContentOut])
def my_library(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_member),
):
    unlocked_ids = {mc.content_id for mc in current_user.unlocked_content}
    items = db.query(ContentItem).filter(ContentItem.id.in_(unlocked_ids)).order_by(ContentItem.published_at.desc()).all()
    return [_serialize(i, unlocked_ids) for i in items]
