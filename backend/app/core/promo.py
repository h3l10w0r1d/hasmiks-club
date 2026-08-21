"""Promo-code validation and pricing — shared by the member-facing
`POST /packages/promo/preview`, the checkout that actually applies a code,
and the admin router's validation of new codes.

Kept out of the routers so the price a member is quoted at preview time and
the price they are charged at checkout can never drift apart: both call
`evaluate()`.
"""
import random
import string
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.promo_code import PromoCode, PromoRedemption

# No 0/O/1/I/5/S — generated codes get read off a screen and typed by hand,
# and this is the club's 50+ audience; ambiguous glyphs cause failed redemptions.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ2346789"


def generate_code(db: Session, prefix: str = "", length: int = 8) -> str:
    """A random unused code, optionally prefixed (e.g. "SPRING-"). Retries on
    the astronomically unlikely collision rather than trusting randomness."""
    prefix = (prefix or "").strip().upper()
    body_len = max(4, min(length, 24))
    for _ in range(25):
        body = "".join(random.choice(_CODE_ALPHABET) for _ in range(body_len))
        code = f"{prefix}{body}"[:32]
        if not db.query(PromoCode).filter(PromoCode.code == code).first():
            return code
    raise RuntimeError("Could not generate an unused promo code")


def parse_package_keys(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [k.strip() for k in raw.split(",") if k.strip()]


class PromoError(Exception):
    """Why a code can't be used, in words already fit to show a member."""

    def __init__(self, message_en: str, message_hy: str):
        super().__init__(message_en)
        self.message_en = message_en
        self.message_hy = message_hy

    def message(self, lang: str | None) -> str:
        return self.message_hy if (lang or "").lower().startswith("hy") else self.message_en


def find_code(db: Session, code: str) -> PromoCode | None:
    if not code or not code.strip():
        return None
    return db.query(PromoCode).filter(PromoCode.code == code.strip().upper()).first()


def evaluate(db: Session, code_str: str, package: dict, user_id: int) -> tuple[PromoCode, Decimal, Decimal, int]:
    """Validate `code_str` for this member buying this package.

    Returns (promo, original_price, final_price, bonus_credits).
    Raises PromoError with a member-facing reason if it can't be used.
    """
    promo = find_code(db, code_str)
    if promo is None or not promo.active:
        raise PromoError("This promo code isn't valid.", "Այս պրոմո կոդը վավեր չէ:")

    now = datetime.now(timezone.utc)
    # Stored values may be naive depending on the driver; treat them as UTC
    # rather than letting a comparison raise.
    def _aware(dt):
        return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    if _aware(promo.starts_at) and now < _aware(promo.starts_at):
        raise PromoError("This promo code isn't active yet.", "Այս պրոմո կոդը դեռ ակտիվ չէ:")
    if _aware(promo.expires_at) and now > _aware(promo.expires_at):
        raise PromoError("This promo code has expired.", "Այս պրոմո կոդի ժամկետը լրացել է:")

    if promo.max_uses is not None and promo.times_used >= promo.max_uses:
        raise PromoError("This promo code has been fully claimed.", "Այս պրոմո կոդն արդեն սպառվել է:")

    if promo.max_uses_per_user is not None:
        mine = (
            db.query(PromoRedemption)
            .filter(PromoRedemption.promo_code_id == promo.id, PromoRedemption.user_id == user_id)
            .count()
        )
        if mine >= promo.max_uses_per_user:
            raise PromoError("You've already used this promo code.", "Դուք արդեն օգտագործել եք այս պրոմո կոդը:")

    allowed = parse_package_keys(promo.package_keys)
    if allowed and package.get("id") not in allowed:
        raise PromoError("This promo code doesn't apply to that package.", "Այս պրոմո կոդը չի գործում այս փաթեթի համար:")

    original = Decimal(str(package["price"]))
    final = original
    if promo.percent_off:
        final = original * (Decimal(100 - promo.percent_off) / Decimal(100))
    elif promo.amount_off:
        final = original - Decimal(str(promo.amount_off))
    # A discount can zero a package out but never go negative, and money is
    # charged in whole drams.
    final = max(Decimal("0"), final).quantize(Decimal("1"))

    return promo, original, final, int(promo.bonus_credits or 0)


def record_redemption(db: Session, promo: PromoCode, user_id: int, member_package_id: int | None,
                      discount_amount: Decimal, bonus_credits: int) -> None:
    """Burn one use. Called only once a purchase is actually paid, so an
    abandoned or failed checkout never consumes the code."""
    db.add(PromoRedemption(
        promo_code_id=promo.id,
        user_id=user_id,
        member_package_id=member_package_id,
        discount_amount=discount_amount,
        bonus_credits=bonus_credits,
    ))
    promo.times_used = (promo.times_used or 0) + 1
    db.commit()
