"""
Gallery: admin CRUD + member read-only.
"""
from typing import List, Optional

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_admin, get_current_user
from app.database import get_db
from app.models.album import Album, AlbumPhoto
from app.models.user import User

router = APIRouter(tags=["gallery"])


# ── schemas ───────────────────────────────────────────────────────────────────

class PhotoOut(BaseModel):
    id: int
    url: str
    caption: Optional[str]
    sort_order: int
    model_config = {"from_attributes": True}


class AlbumOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    event_id: Optional[int]
    cover_url: Optional[str]
    created_at: str
    photo_count: int = 0
    model_config = {"from_attributes": True}


class AlbumDetail(AlbumOut):
    photos: List[PhotoOut] = []


class AlbumIn(BaseModel):
    title: str
    description: Optional[str] = None
    event_id: Optional[int] = None
    cover_url: Optional[str] = None


class PhotoIn(BaseModel):
    url: str
    caption: Optional[str] = None
    sort_order: int = 0


# ── member endpoints ──────────────────────────────────────────────────────────

@router.get("/gallery", response_model=List[AlbumOut])
def get_albums(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    albums = db.query(Album).order_by(Album.created_at.desc()).all()
    return [
        AlbumOut(
            id=a.id, title=a.title, description=a.description,
            event_id=a.event_id, cover_url=a.cover_url,
            created_at=a.created_at.isoformat(),
            photo_count=len(a.photos),
        )
        for a in albums
    ]


@router.get("/gallery/{album_id}", response_model=AlbumDetail)
def get_album(
    album_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    return AlbumDetail(
        id=album.id, title=album.title, description=album.description,
        event_id=album.event_id, cover_url=album.cover_url,
        created_at=album.created_at.isoformat(),
        photo_count=len(album.photos),
        photos=[PhotoOut.model_validate(p) for p in album.photos],
    )


# ── admin endpoints ───────────────────────────────────────────────────────────

@router.get("/admin/gallery", response_model=List[AlbumOut])
def admin_get_albums(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    albums = db.query(Album).order_by(Album.created_at.desc()).all()
    return [
        AlbumOut(
            id=a.id, title=a.title, description=a.description,
            event_id=a.event_id, cover_url=a.cover_url,
            created_at=a.created_at.isoformat(),
            photo_count=len(a.photos),
        )
        for a in albums
    ]


@router.get("/admin/gallery/{album_id}", response_model=AlbumDetail)
def admin_get_album(
    album_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    return AlbumDetail(
        id=album.id, title=album.title, description=album.description,
        event_id=album.event_id, cover_url=album.cover_url,
        created_at=album.created_at.isoformat(),
        photo_count=len(album.photos),
        photos=[PhotoOut.model_validate(p) for p in album.photos],
    )


@router.post("/admin/gallery", response_model=AlbumOut, status_code=201)
def admin_create_album(
    body: AlbumIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    album = Album(**body.model_dump())
    db.add(album)
    db.commit()
    db.refresh(album)
    return AlbumOut(
        id=album.id, title=album.title, description=album.description,
        event_id=album.event_id, cover_url=album.cover_url,
        created_at=album.created_at.isoformat(), photo_count=0,
    )


@router.patch("/admin/gallery/{album_id}", response_model=AlbumOut)
def admin_update_album(
    album_id: int,
    body: AlbumIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(album, k, v)
    db.commit()
    db.refresh(album)
    return AlbumOut(
        id=album.id, title=album.title, description=album.description,
        event_id=album.event_id, cover_url=album.cover_url,
        created_at=album.created_at.isoformat(),
        photo_count=len(album.photos),
    )


@router.delete("/admin/gallery/{album_id}", status_code=204)
def admin_delete_album(
    album_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    db.delete(album)
    db.commit()


@router.post("/admin/gallery/{album_id}/photos", response_model=PhotoOut, status_code=201)
def admin_add_photo(
    album_id: int,
    body: PhotoIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    album = db.query(Album).filter(Album.id == album_id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    photo = AlbumPhoto(album_id=album_id, **body.model_dump())
    db.add(photo)
    # Auto-set cover if album has none
    if not album.cover_url:
        album.cover_url = body.url
    db.commit()
    db.refresh(photo)
    return photo


@router.delete("/admin/gallery/photos/{photo_id}", status_code=204)
def admin_delete_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    photo = db.query(AlbumPhoto).filter(AlbumPhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    db.delete(photo)
    db.commit()


@router.post("/admin/gallery/upload-photo")
async def admin_upload_photo(
    file: UploadFile = File(...),
    _: User = Depends(get_current_admin),
):
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
    )
    data = await file.read()
    result = cloudinary.uploader.upload(data, folder="hasmiks-club-gallery", resource_type="image")
    return {"url": result["secure_url"]}
