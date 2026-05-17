from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Album(Base):
    __tablename__ = "albums"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    event_id = Column(Integer, ForeignKey('events.id', ondelete='SET NULL'), nullable=True)
    cover_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    photos = relationship("AlbumPhoto", back_populates="album", cascade="all, delete-orphan", order_by="AlbumPhoto.sort_order")


class AlbumPhoto(Base):
    __tablename__ = "album_photos"

    id = Column(Integer, primary_key=True)
    album_id = Column(Integer, ForeignKey('albums.id', ondelete='CASCADE'), nullable=False)
    url = Column(String(500), nullable=False)
    caption = Column(String(300), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0, server_default='0')

    album = relationship("Album", back_populates="photos")
