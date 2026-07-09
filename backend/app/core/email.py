"""
All outbound transactional email (via Resend) + Brevo CRM contact/event sync.
Both talk to their REST APIs directly via httpx — no SDKs needed.
"""
import logging
import threading
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings

logger = logging.getLogger(__name__)

_BREVO = "https://api.brevo.com/v3"
_RESEND = "https://api.resend.com/emails"


def _brevo_headers() -> dict:
    return {
        "api-key": settings.BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


# ── transactional email (Resend) ───────────────────────────────────────────────

def _send(to_email: str, to_name: str, subject: str, html: str) -> None:
    if not settings.RESEND_API_KEY:
        logger.warning("Email to %s ('%s') not sent — RESEND_API_KEY is not set", to_email, subject)
        return
    payload = {
        "from": f"{settings.RESEND_SENDER_NAME} <{settings.RESEND_SENDER_EMAIL}>",
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json",
    }
    try:
        resp = httpx.post(_RESEND, json=payload, headers=headers, timeout=10)
        if resp.status_code >= 400:
            logger.error(
                "Resend rejected email to %s ('%s'): %s %s",
                to_email, subject, resp.status_code, resp.text,
            )
    except Exception:
        logger.exception("Failed to send email to %s ('%s')", to_email, subject)


def send_async(to_email: str, to_name: str, subject: str, html: str) -> None:
    if not to_email:
        return  # Telegram-only members have no email — nothing to send, not an error
    threading.Thread(target=_send, args=(to_email, to_name, subject, html), daemon=True).start()


# ── contact management (Brevo CRM) ─────────────────────────────────────────────

def _sync_contact(email: str, attributes: dict) -> None:
    if not settings.BREVO_API_KEY:
        return
    payload: dict = {"email": email, "attributes": attributes, "updateEnabled": True}
    if settings.BREVO_LIST_ID:
        payload["listIds"] = [settings.BREVO_LIST_ID]
    try:
        resp = httpx.post(f"{_BREVO}/contacts", json=payload, headers=_brevo_headers(), timeout=10)
        # A single malformed attribute (e.g. a phone-shaped field Brevo
        # validates by name) rejects the WHOLE payload with a 4xx — every
        # other attribute in this call silently fails to sync too. Log it so
        # that's diagnosable instead of invisible.
        if resp.status_code >= 400:
            logger.warning("Brevo contact sync rejected for %s: %s %s", email, resp.status_code, resp.text)
    except Exception:
        logger.exception("Brevo contact sync failed for %s", email)


def sync_contact_async(email: str, attributes: dict) -> None:
    """Create-or-update a Brevo contact with the given attribute dict."""
    if not email:
        return  # Telegram-only members have no email — nothing to sync
    threading.Thread(target=_sync_contact, args=(email, attributes), daemon=True).start()


def _is_profile_complete(user) -> bool:
    has_contact = bool(user.phone or user.whatsapp or user.facebook_url or user.telegram_username)
    return bool(user.bio and user.photo_url and has_contact)


def _base_attributes(user) -> dict:
    parts = (user.full_name or "").split(" ", 1)
    signup_method = "google" if user.google_id else "telegram" if user.telegram_id else "email"
    attrs: dict = {
        "FIRSTNAME": parts[0],
        "LASTNAME": parts[1] if len(parts) > 1 else "",
        "MEMBERSHIP_STATUS": user.membership_status,
        "APPLICATION_STATUS": user.application_status,
        "SIGNUP_METHOD": signup_method,
        "LANG_PREF": user.lang_pref or "en",
        "IS_VERIFIED": bool(user.is_verified),
        "ONBOARDING_DONE": bool(user.onboarding_completed),
        "TELEGRAM_LINKED": bool(user.telegram_id),
        "PROFILE_COMPLETE": _is_profile_complete(user),
        "REFERRAL_CODE": user.referral_code or "",
    }
    if user.whatsapp or user.phone:
        # Brevo's SMS/WHATSAPP/LANDLINE_NUMBER attributes enforce phone-number
        # format server-side despite showing "type": "text" in the schema —
        # a malformed value there gets the WHOLE contact sync rejected (400),
        # silently dropping every other attribute too. The phone field here is
        # free-text with no validation, so real data isn't reliably E.164.
        # PHONE is a plain custom text attribute with no such enforcement.
        attrs["PHONE"] = user.whatsapp or user.phone
    if user.joined_at:
        attrs["JOINED_AT"] = user.joined_at.date().isoformat()
    if user.referred_by_id and user.referred_by:
        attrs["REFERRED_BY_NAME"] = user.referred_by.full_name
    return attrs


def _engagement_attributes(db: Session, user) -> dict:
    """Computed attributes that need a DB round-trip — event/payment history."""
    from sqlalchemy import func

    from app.models.rsvp import RSVP
    from app.models.event import Event
    from app.models.ameria_payment import AmeriaPayment
    from app.models.content import MemberContent
    from app.models.user import User

    attrs: dict = {
        "EVENTS_ATTENDED": db.query(RSVP).filter(RSVP.user_id == user.id, RSVP.checked_in == True).count(),
        "REFERRAL_COUNT": db.query(User).filter(User.referred_by_id == user.id).count(),
        "CONTENT_UNLOCKED": db.query(MemberContent).filter(MemberContent.user_id == user.id).count(),
    }

    last_event_date = (
        db.query(Event.event_date)
        .join(RSVP, RSVP.event_id == Event.id)
        .filter(RSVP.user_id == user.id)
        .order_by(Event.event_date.desc())
        .first()
    )
    if last_event_date:
        attrs["LAST_EVENT_DATE"] = last_event_date[0].date().isoformat()

    last_payment = (
        db.query(AmeriaPayment)
        .filter(AmeriaPayment.user_id == user.id)
        .order_by(AmeriaPayment.created_at.desc())
        .first()
    )
    if last_payment:
        attrs["LAST_PAYMENT_DATE"] = last_payment.created_at.date().isoformat()
        attrs["LAST_PAYMENT_STATUS"] = last_payment.status

    lifetime_value = (
        db.query(func.coalesce(func.sum(AmeriaPayment.amount), 0))
        .filter(AmeriaPayment.user_id == user.id, AmeriaPayment.status == "approved")
        .scalar()
    )
    attrs["LIFETIME_VALUE"] = float(lifetime_value or 0)

    return attrs


def sync_member_to_brevo(db: Session, user) -> None:
    """Push the full attribute set for this member to Brevo (create-or-update).

    Call this after anything that changes a synced field: membership status,
    application status, an RSVP/check-in, or a payment.
    """
    if not user.email or not settings.BREVO_API_KEY:
        return
    attrs = _base_attributes(user)
    attrs.update(_engagement_attributes(db, user))
    sync_contact_async(user.email, attrs)


# ── behavioral events (Brevo marketing automation triggers) ────────────────────

def _track_event(email: str, event_name: str, event_properties: Optional[dict]) -> None:
    if not settings.BREVO_API_KEY:
        return
    payload: dict = {"event_name": event_name, "identifiers": {"email_id": email}}
    if event_properties:
        payload["event_properties"] = event_properties
    try:
        resp = httpx.post(f"{_BREVO}/events", json=payload, headers=_brevo_headers(), timeout=10)
        if resp.status_code >= 400:
            logger.warning("Brevo event '%s' rejected for %s: %s %s", event_name, email, resp.status_code, resp.text)
    except Exception:
        logger.exception("Brevo event '%s' failed for %s", event_name, email)


def track_event_async(email: str, event_name: str, event_properties: Optional[dict] = None) -> None:
    """Fire a timestamped behavioral event Brevo automations can trigger on."""
    if not email:
        return  # Telegram-only members have no email — nothing to track
    threading.Thread(target=_track_event, args=(email, event_name, event_properties), daemon=True).start()


# ── email templates ────────────────────────────────────────────────────────────

_STYLE = """
<style>
  body { font-family: Georgia, serif; color: #2c1a1a; background: #fff8f5; margin: 0; padding: 0; }
  .wrap { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 16px;
          padding: 40px; box-shadow: 0 4px 20px rgba(192,57,75,.08); }
  .logo { font-size: 22px; color: #c0394b; font-weight: 700; margin-bottom: 24px; }
  .logo span { color: #8b1a2a; }
  h2 { color: #2c1a1a; margin: 0 0 16px; }
  p { line-height: 1.7; color: #444; margin: 0 0 16px; }
  .btn { display: inline-block; background: #c0394b; color: #fff !important; padding: 12px 28px;
         border-radius: 8px; text-decoration: none; font-weight: 600; margin: 8px 0; }
  .meta { background: #fdf0f0; border-radius: 10px; padding: 16px; margin: 16px 0; }
  .meta p { margin: 4px 0; color: #555; font-size: 14px; }
  .footer { margin-top: 32px; font-size: 12px; color: #aaa; border-top: 1px solid #f0e0e5; padding-top: 16px; }
</style>
"""


def _wrap(body: str) -> str:
    return f"""<!DOCTYPE html><html><head>{_STYLE}</head><body>
    <div class="wrap">
      <div class="logo">Hasmik's <span>Club</span></div>
      {body}
      <div class="footer">You received this email because you are a member of Hasmik's Club.</div>
    </div></body></html>"""


def send_welcome(to: str, name: str) -> None:
    html = _wrap(f"""
    <h2>Welcome, {name}! 🌸</h2>
    <p>We're so happy you joined Hasmik's Club — a warm, intimate community for Armenian women.</p>
    <p>Your account is ready. Visit your dashboard to explore upcoming events and exclusive content.</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Go to my dashboard</a>
    <p>With love,<br><strong>The Hasmik's Club team</strong></p>
    """)
    send_async(to, name, "Welcome to Hasmik's Club 🌸", html)


def send_rsvp_confirmation(to: str, name: str, event_title: str, event_date: str, location: str) -> None:
    html = _wrap(f"""
    <h2>You're confirmed, {name}! ✅</h2>
    <p>Your spot for <strong>{event_title}</strong> is reserved.</p>
    <div class="meta">
      <p>📍 <strong>Location:</strong> {location}</p>
      <p>🗓 <strong>Date:</strong> {event_date}</p>
    </div>
    <p>We look forward to seeing you there!</p>
    <p>Hasmik's Club</p>
    """)
    send_async(to, name, f"RSVP Confirmed: {event_title}", html)


def send_guest_ticket_confirmation(to: str, name: str, event_title: str, event_date: str, location: str) -> None:
    html = _wrap(f"""
    <h2>You're in, {name}! 🎟️</h2>
    <p>Your one-time ticket for <strong>{event_title}</strong> is confirmed — no membership needed, just show up!</p>
    <div class="meta">
      <p>📍 <strong>Location:</strong> {location}</p>
      <p>🗓 <strong>Date:</strong> {event_date}</p>
    </div>
    <p>We look forward to seeing you there!</p>
    <p>Hasmik's Club</p>
    """)
    send_async(to, name, f"Ticket Confirmed: {event_title}", html)


def send_rsvp_cancelled(to: str, name: str, event_title: str) -> None:
    html = _wrap(f"""
    <h2>RSVP cancelled</h2>
    <p>Hi {name}, your RSVP for <strong>{event_title}</strong> has been cancelled.</p>
    <p>You can always re-register if plans change.</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">View events</a>
    """)
    send_async(to, name, f"RSVP Cancelled: {event_title}", html)


def send_event_reminder(to: str, name: str, event_title: str, event_date: str, location: str) -> None:
    html = _wrap(f"""
    <h2>See you tomorrow, {name}! 🌺</h2>
    <p>Just a reminder that <strong>{event_title}</strong> is happening tomorrow.</p>
    <div class="meta">
      <p>📍 <strong>Location:</strong> {location}</p>
      <p>🗓 <strong>Date:</strong> {event_date}</p>
    </div>
    <p>We can't wait to see you!</p>
    <p>Hasmik's Club</p>
    """)
    send_async(to, name, f"Tomorrow: {event_title} 🗓", html)


def send_verification(to: str, name: str, verify_url: str) -> None:
    html = _wrap(f"""
    <h2>Verify your email, {name}!</h2>
    <p>Thanks for joining Hasmik's Club. Please verify your email address to get started.</p>
    <a href="{verify_url}" class="btn">Verify my email</a>
    <p style="font-size:13px;color:#888;">This link expires in 24 hours.</p>
    """)
    send_async(to, name, "Please verify your email — Hasmik's Club", html)


def send_waitlist_joined(to: str, name: str, event_title: str, position: int) -> None:
    html = _wrap(f"""
    <h2>You're on the waitlist, {name}!</h2>
    <p>You're <strong>#{position}</strong> on the waitlist for <strong>{event_title}</strong>.</p>
    <p>We'll email you immediately if a spot opens up.</p>
    """)
    send_async(to, name, f"Waitlist #{position}: {event_title}", html)


def send_waitlist_promoted(to: str, name: str, event_title: str, event_date: str, location: str) -> None:
    html = _wrap(f"""
    <h2>Great news, {name}! A spot opened up 🎉</h2>
    <p>You've been automatically registered for <strong>{event_title}</strong>.</p>
    <div class="meta">
      <p>📍 <strong>Location:</strong> {location}</p>
      <p>🗓 <strong>Date:</strong> {event_date}</p>
    </div>
    <p>See you there!</p>
    """)
    send_async(to, name, f"You're in! Spot opened for {event_title}", html)


def send_broadcast(to: str, name: str, subject: str, body: str) -> None:
    paragraphs = "".join(f"<p>{line}</p>" for line in body.strip().split("\n") if line.strip())
    html = _wrap(f"""
    <h2>{subject}</h2>
    {paragraphs}
    """)
    send_async(to, name, subject, html)


def send_telegram_invite(to: str, name: str, invite_url: str) -> None:
    html = _wrap(f"""
    <h2>You're in, {name}! 🎉</h2>
    <p>Your Hasmik's Club membership is now active. Join our private Telegram group to connect with the community:</p>
    <a href="{invite_url}" class="btn">Join Telegram Group →</a>
    <p style="font-size:13px;color:#888;">This is a one-time invite link. Please do not share it.</p>
    """)
    send_async(to, name, "Welcome to Hasmik's Club — join us on Telegram", html)


def send_application_received(to: str, name: str) -> None:
    html = _wrap(f"""
    <h2>Application received, {name}!</h2>
    <p>Thank you for applying to join Hasmik's Club. We've received your application and will review it shortly.</p>
    <p>You'll receive an email once your application has been reviewed. We appreciate your patience!</p>
    <p>With warmth,<br><strong>The Hasmik's Club team</strong></p>
    """)
    send_async(to, name, "Application received — Hasmik's Club", html)


def send_application_approved(to: str, name: str) -> None:
    html = _wrap(f"""
    <h2>You're in, {name}! 🌸</h2>
    <p>Your application to join Hasmik's Club has been approved. Welcome to our community!</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Go to my dashboard</a>
    <p>With love,<br><strong>The Hasmik's Club team</strong></p>
    """)
    send_async(to, name, "You've been approved — Hasmik's Club 🌸", html)


def send_application_declined(to: str, name: str) -> None:
    html = _wrap(f"""
    <h2>Thank you for your interest, {name}</h2>
    <p>After careful consideration, we are unable to offer you a spot at this time. We hope to welcome you in the future.</p>
    <p>With warmth,<br><strong>The Hasmik's Club team</strong></p>
    """)
    send_async(to, name, "Regarding your Hasmik's Club application", html)


def send_password_reset(to: str, name: str, reset_url: str) -> None:
    html = _wrap(f"""
    <h2>Reset your password</h2>
    <p>Hi {name}, we received a request to reset your Hasmik's Club password.</p>
    <a href="{reset_url}" class="btn">Reset Password</a>
    <p style="font-size:13px;color:#888;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    """)
    send_async(to, name, "Reset your Hasmik's Club password", html)
