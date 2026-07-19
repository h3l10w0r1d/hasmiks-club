from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class ForumTopic(Base):
    __tablename__ = "forum_topics"
    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    title       = Column(String(200), nullable=False)
    body        = Column(Text, nullable=False)
    image_url   = Column(Text, nullable=True)  # uploaded image or Giphy GIF URL
    category    = Column(String(50), nullable=False, default='general')
    pinned      = Column(Boolean, nullable=False, default=False)
    is_deleted  = Column(Boolean, nullable=False, default=False)
    post_count  = Column(Integer, nullable=False, default=0)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    author = relationship("User", foreign_keys=[user_id])
    posts  = relationship("ForumPost", back_populates="topic", cascade="all, delete-orphan",
                          primaryjoin="and_(ForumPost.topic_id==ForumTopic.id, ForumPost.is_deleted==False)",
                          order_by="ForumPost.created_at")

class ForumPost(Base):
    __tablename__ = "forum_posts"
    id         = Column(Integer, primary_key=True)
    topic_id   = Column(Integer, ForeignKey('forum_topics.id', ondelete='CASCADE'), nullable=False)
    user_id    = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    body       = Column(Text, nullable=False)
    image_url  = Column(Text, nullable=True)  # uploaded image or Giphy GIF URL
    is_deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    topic  = relationship("ForumTopic", back_populates="posts")
    author = relationship("User", foreign_keys=[user_id])


class ForumReaction(Base):
    """Emoji reaction from one member on a topic or a post.

    target_type is 'topic' or 'post'; target_id references the matching table.
    A member may add several distinct emojis to the same target, but only one
    row per (member, target, emoji) — enforced by the unique constraint.
    """
    __tablename__ = "forum_reactions"
    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    target_type = Column(String(10), nullable=False)  # 'topic' | 'post'
    target_id   = Column(Integer, nullable=False)
    emoji       = Column(String(16), nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (
        UniqueConstraint('user_id', 'target_type', 'target_id', 'emoji', name='uq_forum_reaction'),
        Index('ix_forum_reactions_target', 'target_type', 'target_id'),
    )


class ForumReport(Base):
    """A member flagging a topic or post for moderator review.

    Same polymorphic target_type/target_id shape as ForumReaction. A pending
    report is resolved (moderator took action, e.g. deleted the content) or
    dismissed (moderator reviewed it and left the content as-is).
    """
    __tablename__ = "forum_reports"
    id            = Column(Integer, primary_key=True)
    reporter_id   = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    target_type   = Column(String(10), nullable=False)  # 'topic' | 'post'
    target_id     = Column(Integer, nullable=False)
    reason        = Column(Text, nullable=True)
    status        = Column(String(20), nullable=False, default='pending')  # pending | resolved | dismissed
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at   = Column(DateTime(timezone=True), nullable=True)
    resolved_by_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)

    reporter    = relationship("User", foreign_keys=[reporter_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])

    __table_args__ = (
        Index('ix_forum_reports_target', 'target_type', 'target_id'),
        Index('ix_forum_reports_status', 'status'),
    )
