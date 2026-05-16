from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, members, events, content

app = FastAPI(title="Hasmik's Club API", version="1.0.0")

import os

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


@app.get("/health")
def health():
    return {"status": "ok"}
