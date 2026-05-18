"""
Member forum — threaded discussions.
"""
import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_permission
from app.database import get_db
from app.models.forum import ForumTopic, ForumPost
from app.models.user import User

router = APIRouter(prefix="/forum", tags=["forum"])

CATEGORIES = ["general", "events", "resources", "introductions", "off-topic"]

# ── schemas ───────────────────────────────────────────────────────────────────

class AuthorOut(BaseModel):
    id: int
    full_name: str
    photo_url: Optional[str] = None
    model_config = {"from_attributes": True}

class PostOut(BaseModel):
    id: int
    topic_id: int
    body: str
    created_at: datetime
    updated_at: datetime
    author: AuthorOut
    model_config = {"from_attributes": True}

class TopicOut(BaseModel):
    id: int
    title: str
    body: str
    category: str
    pinned: bool
    post_count: int
    created_at: datetime
    updated_at: datetime
    author: AuthorOut
    model_config = {"from_attributes": True}

class TopicDetail(TopicOut):
    posts: List[PostOut] = []

class TopicIn(BaseModel):
    title: str
    body: str
    category: str = "general"

class PostIn(BaseModel):
    body: str

# ── helpers ───────────────────────────────────────────────────────────────────

def _topic_or_404(db, topic_id):
    t = db.query(ForumTopic).filter(ForumTopic.id == topic_id, ForumTopic.is_deleted == False).first()
    if not t:
        raise HTTPException(404, "Topic not found")
    return t

# ── member endpoints ──────────────────────────────────────────────────────────

@router.get("", response_model=List[TopicOut])
def list_topics(category: Optional[str] = None, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    q = db.query(ForumTopic).filter(ForumTopic.is_deleted == False)
    if category:
        q = q.filter(ForumTopic.category == category)
    topics = q.order_by(ForumTopic.pinned.desc(), ForumTopic.updated_at.desc()).all()
    return topics

@router.post("", response_model=TopicOut, status_code=201)
def create_topic(body: TopicIn, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    if body.category not in CATEGORIES:
        raise HTTPException(400, f"Invalid category. Valid: {CATEGORIES}")
    topic = ForumTopic(user_id=user.id, **body.model_dump())
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic

@router.get("/{topic_id}", response_model=TopicDetail)
def get_topic(topic_id: int, db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    return _topic_or_404(db, topic_id)

@router.post("/{topic_id}/posts", response_model=PostOut, status_code=201)
def create_post(topic_id: int, body: PostIn, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    topic = _topic_or_404(db, topic_id)
    post = ForumPost(topic_id=topic_id, user_id=user.id, body=body.body)
    db.add(post)
    topic.post_count = (topic.post_count or 0) + 1
    topic.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(post)
    return post

@router.delete("/{topic_id}", status_code=204)
def delete_topic(topic_id: int, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    topic = _topic_or_404(db, topic_id)
    # Author or admin can delete
    from app.core.deps import has_permission
    if topic.user_id != user.id and not has_permission(user, 'manage_members'):
        raise HTTPException(403, "Not your topic")
    topic.is_deleted = True
    db.commit()

@router.delete("/posts/{post_id}", status_code=204)
def delete_post(post_id: int, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    post = db.query(ForumPost).filter(ForumPost.id == post_id, ForumPost.is_deleted == False).first()
    if not post:
        raise HTTPException(404, "Post not found")
    from app.core.deps import has_permission
    if post.user_id != user.id and not has_permission(user, 'manage_members'):
        raise HTTPException(403, "Not your post")
    post.is_deleted = True
    topic = db.query(ForumTopic).filter(ForumTopic.id == post.topic_id).first()
    if topic:
        topic.post_count = max(0, (topic.post_count or 1) - 1)
    db.commit()

# ── admin endpoints ───────────────────────────────────────────────────────────

@router.patch("/{topic_id}/pin", status_code=204)
def pin_topic(topic_id: int, db: Session = Depends(get_db),
              _: User = Depends(require_permission('manage_members'))):
    topic = _topic_or_404(db, topic_id)
    topic.pinned = not topic.pinned
    db.commit()
