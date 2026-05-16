from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class ContentType(str, enum.Enum):
    recipe = "recipe"
    ebook = "ebook"


class ContentItem(Base):
    __tablename__ = "content_items"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False)  # recipe | ebook
    title = Column(String, nullable=False)
    title_hy = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    description_hy = Column(Text, nullable=True)
    file_url = Column(String, nullable=True)
    cover_url = Column(String, nullable=True)
    published_at = Column(DateTime(timezone=True), server_default=func.now())

    member_access = relationship("MemberContent", back_populates="content", cascade="all, delete-orphan")


class MemberContent(Base):
    __tablename__ = "member_content"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content_id = Column(Integer, ForeignKey("content_items.id"), nullable=False)
    unlocked_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="unlocked_content")
    content = relationship("ContentItem", back_populates="member_access")
