"""Admin CRUD for promo codes, plus the code generator the create form uses.

Guarded by the same `manage_settings` permission as packages — promo codes
are a pricing lever, so whoever can set prices can set discounts.
"""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core import promo as promo_core
from app.core.deps import require_permission
from app.database import get_db
from app.models.promo_code import PromoCode, PromoRedemption
from app.models.user import User

router = APIRouter(prefix="/admin/promo-codes", tags=["admin-promo"])


class PromoIn(BaseModel):
    code: Optional[str] = None          # blank on create = generate one
    description: Optional[str] = None
    percent_off: Optional[int] = None
    amount_off: Optional[float] = None
    bonus_credits: int = 0
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = None
    max_uses_per_user: Optional[int] = 1
    package_keys: List[str] = []
    active: bool = True


class PromoOut(BaseModel):
    id: int
    code: str
    description: Optional[str] = None
    percent_off: Optional[int] = None
    amount_off: Optional[float] = None
    bonus_credits: int = 0
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = None
    max_uses_per_user: Optional[int] = None
    package_keys: List[str] = []
    times_used: int = 0
    active: bool = True
    created_at: Optional[datetime] = None


def _out(p: PromoCode) -> PromoOut:
    return PromoOut(
        id=p.id, code=p.code, description=p.description,
        percent_off=p.percent_off,
        amount_off=float(p.amount_off) if p.amount_off is not None else None,
        bonus_credits=p.bonus_credits or 0,
        starts_at=p.starts_at, expires_at=p.expires_at,
        max_uses=p.max_uses, max_uses_per_user=p.max_uses_per_user,
        package_keys=promo_core.parse_package_keys(p.package_keys),
        times_used=p.times_used or 0, active=p.active,
        created_at=p.created_at,
    )


def _validate(body: PromoIn) -> None:
    """Reject combinations that would make the charged price ambiguous or the
    code pointless, before anything is written."""
    if body.percent_off is not None and body.amount_off is not None:
        raise HTTPException(422, "Use either a percentage or a fixed amount, not both")
    if body.percent_off is not None and not (1 <= body.percent_off <= 100):
        raise HTTPException(422, "Percentage must be between 1 and 100")
    if body.amount_off is not None and body.amount_off <= 0:
        raise HTTPException(422, "Fixed amount must be greater than zero")
    if body.bonus_credits < 0:
        raise HTTPException(422, "Bonus visits cannot be negative")
    if body.percent_off is None and body.amount_off is None and not body.bonus_credits:
        raise HTTPException(422, "A code must give something — a discount, bonus visits, or both")
    if body.max_uses is not None and body.max_uses < 1:
        raise HTTPException(422, "Total use limit must be at least 1")
    if body.max_uses_per_user is not None and body.max_uses_per_user < 1:
        raise HTTPException(422, "Per-member limit must be at least 1")
    if body.starts_at and body.expires_at and body.expires_at <= body.starts_at:
        raise HTTPException(422, "The end date must be after the start date")


def _apply(p: PromoCode, body: PromoIn) -> None:
    p.description = body.description
    p.percent_off = body.percent_off
    p.amount_off = Decimal(str(body.amount_off)) if body.amount_off is not None else None
    p.bonus_credits = body.bonus_credits or 0
    p.starts_at = body.starts_at
    p.expires_at = body.expires_at
    p.max_uses = body.max_uses
    p.max_uses_per_user = body.max_uses_per_user
    p.package_keys = ",".join(body.package_keys) if body.package_keys else None
    p.active = body.active


@router.get("/generate")
def generate(prefix: str = "", db: Session = Depends(get_db),
             _: User = Depends(require_permission('manage_settings'))) -> dict:
    return {"code": promo_core.generate_code(db, prefix)}


@router.get("", response_model=List[PromoOut])
def list_codes(db: Session = Depends(get_db),
               _: User = Depends(require_permission('manage_settings'))):
    rows = db.query(PromoCode).order_by(PromoCode.created_at.desc().nullslast(), PromoCode.id.desc()).all()
    return [_out(p) for p in rows]


@router.post("", response_model=PromoOut, status_code=201)
def create_code(body: PromoIn, db: Session = Depends(get_db),
                admin: User = Depends(require_permission('manage_settings'))):
    _validate(body)
    code = (body.code or "").strip().upper() or promo_core.generate_code(db)
    if db.query(PromoCode).filter(PromoCode.code == code).first():
        raise HTTPException(409, "That code already exists")
    p = PromoCode(code=code, created_by_id=admin.id)
    _apply(p, body)
    db.add(p)
    db.commit()
    db.refresh(p)
    return _out(p)


@router.patch("/{promo_id}", response_model=PromoOut)
def update_code(promo_id: int, body: PromoIn, db: Session = Depends(get_db),
                _: User = Depends(require_permission('manage_settings'))):
    p = db.query(PromoCode).filter(PromoCode.id == promo_id).first()
    if not p:
        raise HTTPException(404, "Promo code not found")
    _validate(body)
    if body.code and body.code.strip().upper() != p.code:
        new_code = body.code.strip().upper()
        if db.query(PromoCode).filter(PromoCode.code == new_code).first():
            raise HTTPException(409, "That code already exists")
        p.code = new_code
    _apply(p, body)
    db.commit()
    db.refresh(p)
    return _out(p)


@router.delete("/{promo_id}", status_code=204)
def delete_code(promo_id: int, db: Session = Depends(get_db),
                _: User = Depends(require_permission('manage_settings'))):
    p = db.query(PromoCode).filter(PromoCode.id == promo_id).first()
    if not p:
        raise HTTPException(404, "Promo code not found")
    # Redemptions cascade — the purchases themselves keep their snapshotted
    # promo_code string, so past orders stay readable after a code is deleted.
    db.delete(p)
    db.commit()


@router.get("/{promo_id}/redemptions")
def list_redemptions(promo_id: int, db: Session = Depends(get_db),
                     _: User = Depends(require_permission('manage_settings'))) -> list:
    rows = (
        db.query(PromoRedemption, User)
        .join(User, User.id == PromoRedemption.user_id)
        .filter(PromoRedemption.promo_code_id == promo_id)
        .order_by(PromoRedemption.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id, "user_id": u.id, "user_name": u.full_name, "user_email": u.email,
            "discount_amount": float(r.discount_amount or 0),
            "bonus_credits": r.bonus_credits or 0,
            "created_at": r.created_at,
        }
        for r, u in rows
    ]
