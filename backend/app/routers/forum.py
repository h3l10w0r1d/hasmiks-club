"""
Member forum — threaded discussions with emoji reactions, image/GIF
attachments, sorting and search.
"""
from datetime import datetime, timezone
from typing import List, Optional, Dict

import cloudinary
import cloudinary.uploader
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_current_active_member, require_permission
from app.core.config import settings
from app.database import get_db
from app.models.forum import ForumTopic, ForumPost, ForumReaction
from app.models.user import User

router = APIRouter(prefix="/forum", tags=["forum"])

CATEGORIES = ["general", "events", "resources", "introductions", "off-topic"]
SORTS = ["latest", "oldest", "most_liked", "most_replies"]

# ── schemas ───────────────────────────────────────────────────────────────────

class AuthorOut(BaseModel):
    id: int
    full_name: str
    photo_url: Optional[str] = None
    model_config = {"from_attributes": True}

class ReactionOut(BaseModel):
    emoji: str
    count: int
    reacted: bool  # did the requesting user add this emoji

class PostOut(BaseModel):
    id: int
    topic_id: int
    body: str
    image_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    author: AuthorOut
    reactions: List[ReactionOut] = []
    model_config = {"from_attributes": True}

class TopicOut(BaseModel):
    id: int
    title: str
    body: str
    image_url: Optional[str] = None
    category: str
    pinned: bool
    post_count: int
    created_at: datetime
    updated_at: datetime
    author: AuthorOut
    reactions: List[ReactionOut] = []
    reaction_count: int = 0
    model_config = {"from_attributes": True}

class TopicDetail(TopicOut):
    posts: List[PostOut] = []

class TopicIn(BaseModel):
    title: str
    body: str
    category: str = "general"
    image_url: Optional[str] = None

class PostIn(BaseModel):
    body: str
    image_url: Optional[str] = None

class ReactionIn(BaseModel):
    emoji: str

# ── reaction helpers ──────────────────────────────────────────────────────────

def _reactions_for(db: Session, target_type: str, target_ids: List[int], user_id: int
                   ) -> Dict[int, List[ReactionOut]]:
    """Batch-load emoji reactions for many targets → {target_id: [ReactionOut]}.

    Ordered by descending count so the most-used emoji shows first.
    """
    grouped: Dict[int, List[ReactionOut]] = {tid: [] for tid in target_ids}
    if not target_ids:
        return grouped

    counts = (
        db.query(
            ForumReaction.target_id,
            ForumReaction.emoji,
            func.count(ForumReaction.id).label("count"),
        )
        .filter(ForumReaction.target_type == target_type, ForumReaction.target_id.in_(target_ids))
        .group_by(ForumReaction.target_id, ForumReaction.emoji)
        .all()
    )
    # Which (target, emoji) pairs the requesting user reacted to.
    mine = {
        (tid, emoji)
        for tid, emoji in db.query(ForumReaction.target_id, ForumReaction.emoji).filter(
            ForumReaction.target_type == target_type,
            ForumReaction.target_id.in_(target_ids),
            ForumReaction.user_id == user_id,
        )
    }
    for target_id, emoji, count in counts:
        grouped[target_id].append(
            ReactionOut(emoji=emoji, count=int(count), reacted=(target_id, emoji) in mine)
        )
    for tid in grouped:
        grouped[tid].sort(key=lambda r: r.count, reverse=True)
    return grouped


def _serialize_topic(topic: ForumTopic, reactions: List[ReactionOut]) -> TopicOut:
    return TopicOut(
        id=topic.id, title=topic.title, body=topic.body, image_url=topic.image_url,
        category=topic.category, pinned=topic.pinned, post_count=topic.post_count,
        created_at=topic.created_at, updated_at=topic.updated_at,
        author=AuthorOut.model_validate(topic.author),
        reactions=reactions, reaction_count=sum(r.count for r in reactions),
    )

# ── helpers ───────────────────────────────────────────────────────────────────

def _topic_or_404(db, topic_id):
    t = db.query(ForumTopic).filter(ForumTopic.id == topic_id, ForumTopic.is_deleted == False).first()
    if not t:
        raise HTTPException(404, "Topic not found")
    return t

# ── topic list / detail ───────────────────────────────────────────────────────

@router.get("", response_model=List[TopicOut])
def list_topics(
    category: Optional[str] = None,
    sort: str = Query("latest"),
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(ForumTopic).filter(ForumTopic.is_deleted == False)
    if category and category != "all":
        query = query.filter(ForumTopic.category == category)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(ForumTopic.title.ilike(like) | ForumTopic.body.ilike(like))

    if sort == "oldest":
        order = [ForumTopic.created_at.asc()]
    elif sort == "most_replies":
        order = [ForumTopic.post_count.desc(), ForumTopic.updated_at.desc()]
    elif sort == "most_liked":
        # Sort by total reactions via a correlated subquery count.
        react_count = (
            db.query(func.count(ForumReaction.id))
            .filter(ForumReaction.target_type == "topic", ForumReaction.target_id == ForumTopic.id)
            .correlate(ForumTopic).scalar_subquery()
        )
        order = [react_count.desc(), ForumTopic.updated_at.desc()]
    else:  # latest
        order = [ForumTopic.updated_at.desc()]

    topics = query.order_by(ForumTopic.pinned.desc(), *order).all()
    react_map = _reactions_for(db, "topic", [t.id for t in topics], user.id)
    return [_serialize_topic(t, react_map.get(t.id, [])) for t in topics]


@router.post("", response_model=TopicOut, status_code=201)
def create_topic(body: TopicIn, db: Session = Depends(get_db),
                 user: User = Depends(get_current_active_member)):
    if body.category not in CATEGORIES:
        raise HTTPException(400, f"Invalid category. Valid: {CATEGORIES}")
    if not body.title.strip() or (not body.body.strip() and not body.image_url):
        raise HTTPException(400, "A title and either text or an image are required")
    topic = ForumTopic(user_id=user.id, **body.model_dump())
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return _serialize_topic(topic, [])


@router.get("/{topic_id}", response_model=TopicDetail)
def get_topic(topic_id: int, db: Session = Depends(get_db),
              user: User = Depends(get_current_user)):
    topic = _topic_or_404(db, topic_id)
    posts = topic.posts
    topic_react = _reactions_for(db, "topic", [topic.id], user.id).get(topic.id, [])
    post_reacts = _reactions_for(db, "post", [p.id for p in posts], user.id)

    base = _serialize_topic(topic, topic_react)
    return TopicDetail(
        **base.model_dump(),
        posts=[
            PostOut(
                id=p.id, topic_id=p.topic_id, body=p.body, image_url=p.image_url,
                created_at=p.created_at, updated_at=p.updated_at,
                author=AuthorOut.model_validate(p.author),
                reactions=post_reacts.get(p.id, []),
            )
            for p in posts
        ],
    )


@router.post("/{topic_id}/posts", response_model=PostOut, status_code=201)
def create_post(topic_id: int, body: PostIn, db: Session = Depends(get_db),
                user: User = Depends(get_current_active_member)):
    topic = _topic_or_404(db, topic_id)
    if not body.body.strip() and not body.image_url:
        raise HTTPException(400, "A reply needs text or an image")
    post = ForumPost(topic_id=topic_id, user_id=user.id, body=body.body, image_url=body.image_url)
    db.add(post)
    topic.post_count = (topic.post_count or 0) + 1
    topic.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(post)
    return PostOut(
        id=post.id, topic_id=post.topic_id, body=post.body, image_url=post.image_url,
        created_at=post.created_at, updated_at=post.updated_at,
        author=AuthorOut.model_validate(post.author), reactions=[],
    )


@router.delete("/{topic_id}", status_code=204)
def delete_topic(topic_id: int, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    topic = _topic_or_404(db, topic_id)
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

# ── reactions ─────────────────────────────────────────────────────────────────

@router.post("/{target_type}/{target_id}/react", response_model=List[ReactionOut])
def toggle_reaction(target_type: str, target_id: int, payload: ReactionIn,
                    db: Session = Depends(get_db),
                    user: User = Depends(get_current_active_member)):
    """Toggle one emoji on a topic or post. Returns the target's full summary."""
    if target_type not in ("topic", "post"):
        raise HTTPException(400, "target_type must be 'topic' or 'post'")
    emoji = payload.emoji.strip()
    if not emoji or len(emoji) > 16:
        raise HTTPException(400, "Invalid emoji")

    # Validate the target exists (and isn't deleted).
    if target_type == "topic":
        _topic_or_404(db, target_id)
    else:
        exists = db.query(ForumPost).filter(ForumPost.id == target_id, ForumPost.is_deleted == False).first()
        if not exists:
            raise HTTPException(404, "Post not found")

    existing = db.query(ForumReaction).filter(
        ForumReaction.user_id == user.id,
        ForumReaction.target_type == target_type,
        ForumReaction.target_id == target_id,
        ForumReaction.emoji == emoji,
    ).first()
    if existing:
        db.delete(existing)
    else:
        db.add(ForumReaction(user_id=user.id, target_type=target_type, target_id=target_id, emoji=emoji))
    db.commit()
    return _reactions_for(db, target_type, [target_id], user.id).get(target_id, [])

# ── attachments: image upload ─────────────────────────────────────────────────

@router.post("/upload-image")
async def upload_forum_image(file: UploadFile = File(...),
                             user: User = Depends(get_current_active_member)):
    if not settings.CLOUDINARY_CLOUD_NAME:
        raise HTTPException(status_code=503, detail="Image upload not configured")
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
    )
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be under 8 MB")
    result = cloudinary.uploader.upload(
        data, folder="hasmiks-club/forum",
        resource_type="image",
        transformation=[{"width": 1200, "height": 1200, "crop": "limit", "quality": "auto"}],
    )
    return {"url": result["secure_url"]}

# ── GIF picker: Giphy proxy (keeps the API key server-side) ────────────────────

def _map_giphy(payload: dict) -> List[dict]:
    items = []
    for g in payload.get("data", []):
        images = g.get("images", {})
        preview = images.get("fixed_width", {}) or images.get("downsized", {})
        full = images.get("downsized_medium", {}) or images.get("original", {})
        if not full.get("url"):
            continue
        items.append({
            "id": g.get("id"),
            "title": g.get("title", ""),
            "preview_url": preview.get("url") or full.get("url"),
            "url": full.get("url"),
        })
    return items


@router.get("/gifs/search")
async def search_gifs(q: str = Query(..., min_length=1), limit: int = 24,
                      user: User = Depends(get_current_user)):
    if not settings.GIPHY_API_KEY:
        raise HTTPException(status_code=503, detail="GIF search not configured")
    async with httpx.AsyncClient(timeout=10) as http:
        resp = await http.get("https://api.giphy.com/v1/gifs/search", params={
            "api_key": settings.GIPHY_API_KEY, "q": q, "limit": min(limit, 50), "rating": "pg-13",
        })
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="GIF provider error")
    return {"gifs": _map_giphy(resp.json())}


@router.get("/gifs/trending")
async def trending_gifs(limit: int = 24, user: User = Depends(get_current_user)):
    if not settings.GIPHY_API_KEY:
        raise HTTPException(status_code=503, detail="GIF search not configured")
    async with httpx.AsyncClient(timeout=10) as http:
        resp = await http.get("https://api.giphy.com/v1/gifs/trending", params={
            "api_key": settings.GIPHY_API_KEY, "limit": min(limit, 50), "rating": "pg-13",
        })
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="GIF provider error")
    return {"gifs": _map_giphy(resp.json())}

# ── admin ─────────────────────────────────────────────────────────────────────

@router.patch("/{topic_id}/pin", status_code=204)
def pin_topic(topic_id: int, db: Session = Depends(get_db),
              _: User = Depends(require_permission('manage_members'))):
    topic = _topic_or_404(db, topic_id)
    topic.pinned = not topic.pinned
    db.commit()
