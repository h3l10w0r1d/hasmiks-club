from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class ForumTopic(Base):
    __tablename__ = "forum_topics"
    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    title       = Column(String(200), nullable=False)
    body        = Column(Text, nullable=False)
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
    is_deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    topic  = relationship("ForumTopic", back_populates="posts")
    author = relationship("User", foreign_keys=[user_id])
