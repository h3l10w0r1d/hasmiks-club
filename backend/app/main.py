import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, members, events, content, admin, payments, settings as settings_router
from app.core.config import settings
from app.database import SessionLocal
from app.models.user import User


def _grant_admin_on_startup() -> None:
    """Ensure ADMIN_EMAIL user has is_admin=True every time the server starts."""
    if not settings.ADMIN_EMAIL:
        return
    db = SessionLocal()
    try:
        user = db.query(User).filter(
            User.email == settings.ADMIN_EMAIL.lower()
        ).first()
        if user and not user.is_admin:
            user.is_admin = True
            db.commit()
    except Exception:
        pass
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _grant_admin_on_startup()
    yield


app = FastAPI(title="Hasmik's Club API", version="1.0.0", lifespan=lifespan)

_raw = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174")
_origins = [o.strip() for o in _raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(members.router)
app.include_router(events.router)
app.include_router(content.router)
app.include_router(admin.router)
app.include_router(payments.router)
app.include_router(settings_router.router)


@app.get("/health")
def health():
    return {"status": "ok"}
