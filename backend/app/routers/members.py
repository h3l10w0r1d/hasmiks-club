import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate
from app.core.deps import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/members", tags=["members"])


def _configure_cloudinary():
    if not settings.CLOUDINARY_CLOUD_NAME:
        raise HTTPException(status_code=503, detail="Photo upload not configured")
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
    )


@router.get("/me", response_model=UserOut)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_profile(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/photo", response_model=UserOut)
async def upload_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _configure_cloudinary()
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    contents = await file.read()
    result = cloudinary.uploader.upload(
        contents,
        folder="hasmiks-club/avatars",
        public_id=f"user_{current_user.id}",
        overwrite=True,
        transformation=[{"width": 400, "height": 400, "crop": "fill", "gravity": "face"}],
    )
    current_user.photo_url = result["secure_url"]
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/{user_id}", response_model=UserOut)
def get_member(user_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")
    return user
