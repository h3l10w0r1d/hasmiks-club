import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserOut
from app.core.deps import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/payments", tags=["payments"])


def _get_stripe():
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


@router.post("/create-checkout")
def create_checkout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_stripe()
    if not settings.STRIPE_PRICE_ID:
        raise HTTPException(status_code=503, detail="Stripe price not configured")

    # Create or reuse Stripe customer
    if current_user.stripe_customer_id:
        customer_id = current_user.stripe_customer_id
    else:
        customer = stripe.Customer.create(
            email=current_user.email,
            name=current_user.full_name,
            metadata={"user_id": str(current_user.id)},
        )
        current_user.stripe_customer_id = customer.id
        db.commit()
        customer_id = customer.id

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": settings.STRIPE_PRICE_ID, "quantity": 1}],
        mode="subscription",
        success_url=settings.STRIPE_SUCCESS_URL + "?payment=success",
        cancel_url=settings.STRIPE_CANCEL_URL + "?payment=cancelled",
    )
    return {"checkout_url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    _get_stripe()
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    obj = event["data"]["object"]

    if event["type"] == "customer.subscription.created":
        _handle_subscription_change(obj, "active", db)
    elif event["type"] == "customer.subscription.updated":
        status = obj.get("status")
        membership = "active" if status == "active" else "inactive"
        _handle_subscription_change(obj, membership, db)
    elif event["type"] in ("customer.subscription.deleted", "customer.subscription.paused"):
        _handle_subscription_change(obj, "inactive", db)

    return {"ok": True}


def _handle_subscription_change(subscription: dict, membership_status: str, db: Session) -> None:
    customer_id = subscription.get("customer")
    if not customer_id:
        return
    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if user:
        user.membership_status = membership_status
        db.commit()
