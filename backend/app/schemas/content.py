from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ContentCreate(BaseModel):
    type: str  # recipe | ebook
    title: str
    title_hy: Optional[str] = None
    description: Optional[str] = None
    description_hy: Optional[str] = None
    file_url: Optional[str] = None
    cover_url: Optional[str] = None


class ContentOut(BaseModel):
    id: int
    type: str
    title: str
    title_hy: Optional[str]
    description: Optional[str]
    description_hy: Optional[str]
    file_url: Optional[str]
    cover_url: Optional[str]
    published_at: datetime
    is_unlocked: bool = False

    model_config = {"from_attributes": True}
