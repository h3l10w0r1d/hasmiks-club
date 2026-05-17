import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.routers import auth, members, events, content, admin, analytics, notifications
from app.routers import settings as settings_router
from app.core.config import settings
from app.database import SessionLocal
from app.models.user import User
from app.models.event import Event
from app.core import email as mailer

scheduler = AsyncIOScheduler()


def _grant_admin_on_startup() -> None:
    if not settings.ADMIN_EMAIL:
        return
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == settings.ADMIN_EMAIL.lower()).first()
        if user and not user.is_admin:
            user.is_admin = True
            db.commit()
    except Exception:
        pass
    finally:
        db.close()


async def _send_event_reminders() -> None:
    """Fire 24-hour-before reminders for events in the [23h, 25h] window."""
    now = datetime.now(timezone.utc)
    window_start = now + timedelta(hours=23)
    window_end = now + timedelta(hours=25)
    db = SessionLocal()
    try:
        upcoming = db.query(Event).filter(
            Event.event_date >= window_start,
            Event.event_date <= window_end,
        ).all()
        for event in upcoming:
            for rsvp in event.rsvps:
                user = rsvp.user
                mailer.send_event_reminder(
                    user.email,
                    user.full_name,
                    event.title,
                    event.event_date.strftime("%B %d, %Y at %H:%M"),
                    event.location,
                )
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _grant_admin_on_startup()
    scheduler.add_job(_send_event_reminders, IntervalTrigger(hours=1), id="event_reminders", replace_existing=True)
    scheduler.start()
    yield
    scheduler.shutdown()


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
app.include_router(analytics.router)
app.include_router(notifications.router)
app.include_router(settings_router.router)


@app.get("/health")
def health():
    return {"status": "ok"}
