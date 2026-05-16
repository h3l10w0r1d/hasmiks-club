from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserRegister, UserOut, TokenOut
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


def _ensure_admin(user: User, db: Session) -> None:
    """Grant is_admin if email matches ADMIN_EMAIL env var."""
    if settings.ADMIN_EMAIL and user.email.lower() == settings.ADMIN_EMAIL.lower():
        if not user.is_admin:
            user.is_admin = True
            db.commit()
            db.refresh(user)


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        lang_pref=payload.lang_pref,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _ensure_admin(user, db)
    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    _ensure_admin(user, db)
    token = create_access_token(str(user.id))
    return TokenOut(access_token=token, user=UserOut.model_validate(user))
