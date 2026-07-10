"""
All outbound transactional email (via Resend) + Brevo CRM contact/event sync.
Both talk to their REST APIs directly via httpx — no SDKs needed.
"""
import logging
import threading
from datetime import datetime, timezone
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
# Card-based layout (logo banner + stacked white rounded cards) matching the
# site's actual brand palette (--rose #7E3434, --deep #180C04, --sand/--cream
# warm neutrals — see frontend/src/App.css :root). The logo is the real
# production-hosted wordmark, not a data: URI — Gmail and most other webmail
# clients strip inline base64 images from HTML mail (see _qr_image_url above
# for the same lesson learned the hard way with the check-in QR).

_LOGO_URL = "https://www.hasmiksclub.am/logo-full.png"

_STYLE = """
<style>
  body { font-family: Georgia, 'Noto Serif Armenian', serif; color: #180C04; background: #F3ECE0; margin: 0; padding: 0; }
  .email-wrap { max-width: 600px; margin: 0 auto; padding: 36px 16px; }
  .logo-block { text-align: center; padding: 8px 0 28px; }
  .logo-block img { max-width: 220px; width: 55%; height: auto; }
  .card { background: #ffffff; border: 1px solid #E4D8C5; border-radius: 16px; overflow: hidden; margin-bottom: 20px; }
  .card-body { padding: 32px 34px; }
  h2 { color: #180C04; font-size: 22px; font-weight: 600; margin: 0 0 16px; line-height: 1.35; }
  p { line-height: 1.75; color: #48301E; font-size: 15px; margin: 0 0 16px; }
  .btn { display: inline-block; background: #7E3434; color: #ffffff !important; padding: 14px 30px;
         border-radius: 10px; text-decoration: none; font-weight: 700; margin: 6px 0 4px; font-size: 15px; }
  .meta { background: #FBF6EC; border: 1px solid #EFE1C8; border-radius: 12px; padding: 18px 20px; margin: 20px 0; }
  .meta p { margin: 6px 0; color: #48301E; font-size: 14px; }
  .small { font-size: 13px; color: #82715C; }
  .signoff { color: #180C04; }
  .footer-card { background: #FBF8F3; }
  .footer-card .card-body { padding: 22px 34px; }
  .footer-card p { color: #A99B8A; font-size: 12px; margin: 4px 0; line-height: 1.6; }
</style>
"""


def _wrap(body: str) -> str:
    year = datetime.now(timezone.utc).year
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">{_STYLE}</head><body>
    <div class="email-wrap">
      <div class="logo-block">
        <img src="{_LOGO_URL}" alt="Hasmik's Club" />
      </div>
      <div class="card"><div class="card-body">
        {body}
      </div></div>
      <div class="card footer-card"><div class="card-body">
        <p>© {year} Hasmik's Club. All rights reserved.</p>
        <p>You're receiving this email because you're part of the Hasmik's Club community — a circle of Armenian women built on warmth, connection, and shared culture.</p>
      </div></div>
    </div></body></html>"""


def send_welcome(to: str, name: str) -> None:
    html = _wrap(f"""
    <h2>Welcome, {name}! 🌸</h2>
    <p>We're so happy you joined Hasmik's Club — a warm, intimate community built for Armenian women to gather, connect, and celebrate our shared culture together.</p>
    <p>Your account is ready to go. Inside your dashboard you'll find upcoming events to RSVP for, a growing library of exclusive content, and a directory to meet the rest of our community.</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Go to my dashboard</a>
    <p class="small">If you ever have questions or just want to say hello, our team is always happy to hear from you.</p>
    <p class="signoff">With love,<br><strong>The Hasmik's Club team</strong></p>
    """)
    send_async(to, name, "Welcome to Hasmik's Club 🌸", html)


def send_rsvp_confirmation(to: str, name: str, event_title: str, event_date: str, location: str) -> None:
    html = _wrap(f"""
    <h2>You're confirmed, {name}! ✅</h2>
    <p>Your spot for <strong>{event_title}</strong> is officially reserved — we can't wait to spend the evening with you.</p>
    <div class="meta">
      <p>📍 <strong>Location:</strong> {location}</p>
      <p>🗓 <strong>Date:</strong> {event_date}</p>
    </div>
    <p>Plans change — if something comes up, you can cancel your RSVP anytime from your dashboard so we can offer your spot to someone on the waitlist.</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">View my events</a>
    <p class="signoff">We look forward to seeing you there!<br><strong>Hasmik's Club</strong></p>
    """)
    send_async(to, name, f"RSVP Confirmed: {event_title}", html)


def _qr_image_url(payload: str) -> Optional[str]:
    """Render a QR code PNG in-memory and host it on Cloudinary, returning a
    normal https:// URL. A data: URI looks correct in a browser preview but
    Gmail (and most other webmail clients) strip inline base64 images from
    HTML mail entirely, so the QR code never actually reaches the guest —
    it has to be a real hosted image."""
    if not settings.CLOUDINARY_CLOUD_NAME:
        logger.warning("Cannot upload check-in QR code — CLOUDINARY_CLOUD_NAME is not set")
        return None
    import io
    import qrcode
    import cloudinary
    import cloudinary.uploader

    img = qrcode.make(payload, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
    )
    result = cloudinary.uploader.upload(buf.getvalue(), folder="hasmiks-club-checkin-qr", resource_type="image")
    return result["secure_url"]


def send_guest_verification_code(to: str, name: str, code: str, event_title: str) -> None:
    html = _wrap(f"""
    <h2>Confirm your email, {name}</h2>
    <p>You're one step away from your ticket for <strong>{event_title}</strong>. Enter this 6-digit code on the checkout page to confirm it's really you and continue to payment:</p>
    <div class="meta" style="text-align:center;">
      <p style="font-size:32px;font-weight:700;letter-spacing:0.3em;color:#7E3434;margin:0;">{code}</p>
    </div>
    <p class="small">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email — no ticket or charge will happen without it.</p>
    """)
    send_async(to, name, f"Your verification code: {code}", html)


def send_guest_ticket_confirmation(to: str, name: str, event_title: str, event_date: str, location: str, checkin_payload: Optional[str] = None) -> None:
    qr_html = ""
    if checkin_payload:
        qr_url = _qr_image_url(checkin_payload)
        if qr_url:
            qr_html = f"""
            <div style="text-align:center;margin:24px 0;">
              <img src="{qr_url}" alt="Check-in QR code" width="200" height="200" style="width:200px;height:200px;border:8px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,.1);" />
              <p class="small" style="margin-top:8px;">Show this QR code at the door — no need to print it, your phone screen works just fine.</p>
            </div>
            """
    html = _wrap(f"""
    <h2>You're in, {name}! 🎟️</h2>
    <p>Your one-time ticket for <strong>{event_title}</strong> is confirmed — no membership needed, just show up and enjoy the evening.</p>
    <div class="meta">
      <p>📍 <strong>Location:</strong> {location}</p>
      <p>🗓 <strong>Date:</strong> {event_date}</p>
    </div>
    {qr_html}
    <p>Hold on to this email — your QR code above is what our team will scan you in with at the door, so no separate printout or ID check is needed.</p>
    <p class="signoff">We look forward to seeing you there!<br><strong>Hasmik's Club</strong></p>
    """)
    send_async(to, name, f"Ticket Confirmed: {event_title}", html)


def send_rsvp_cancelled(to: str, name: str, event_title: str) -> None:
    html = _wrap(f"""
    <h2>RSVP cancelled</h2>
    <p>Hi {name}, your RSVP for <strong>{event_title}</strong> has been cancelled as requested, and your spot has been released back to the group.</p>
    <p>We hope you can join us at a future gathering — new events go up regularly, and we'd love to see you there.</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Browse upcoming events</a>
    """)
    send_async(to, name, f"RSVP Cancelled: {event_title}", html)


def send_event_reminder(to: str, name: str, event_title: str, event_date: str, location: str) -> None:
    html = _wrap(f"""
    <h2>See you tomorrow, {name}! 🌺</h2>
    <p>Just a friendly reminder that <strong>{event_title}</strong> is happening tomorrow — we're looking forward to a wonderful evening together.</p>
    <div class="meta">
      <p>📍 <strong>Location:</strong> {location}</p>
      <p>🗓 <strong>Date:</strong> {event_date}</p>
    </div>
    <p>If your plans have changed and you can no longer make it, please cancel your RSVP from your dashboard so we can offer the spot to someone on the waitlist.</p>
    <p class="signoff">We can't wait to see you!<br><strong>Hasmik's Club</strong></p>
    """)
    send_async(to, name, f"Tomorrow: {event_title} 🗓", html)


def send_verification(to: str, name: str, verify_url: str) -> None:
    html = _wrap(f"""
    <h2>Verify your email, {name}!</h2>
    <p>Thanks so much for joining Hasmik's Club. Before you can dive in, please confirm this is really your email address — it only takes one click.</p>
    <a href="{verify_url}" class="btn">Verify my email</a>
    <p class="small">This link expires in 24 hours. If you didn't create a Hasmik's Club account, you can safely ignore this email.</p>
    """)
    send_async(to, name, "Please verify your email — Hasmik's Club", html)


def send_waitlist_joined(to: str, name: str, event_title: str, position: int) -> None:
    html = _wrap(f"""
    <h2>You're on the waitlist, {name}!</h2>
    <p><strong>{event_title}</strong> is currently full, but you're all set at position <strong>#{position}</strong> on the waitlist.</p>
    <p>The moment a spot opens up, you'll be automatically registered and we'll email you right away — no need to keep checking back.</p>
    """)
    send_async(to, name, f"Waitlist #{position}: {event_title}", html)


def send_waitlist_promoted(to: str, name: str, event_title: str, event_date: str, location: str) -> None:
    html = _wrap(f"""
    <h2>Great news, {name}! A spot opened up 🎉</h2>
    <p>A seat for <strong>{event_title}</strong> just became available, and you've been automatically moved off the waitlist and registered — no action needed from you.</p>
    <div class="meta">
      <p>📍 <strong>Location:</strong> {location}</p>
      <p>🗓 <strong>Date:</strong> {event_date}</p>
    </div>
    <p>If something's come up and you can no longer attend, please let us know by cancelling your RSVP so the spot can go to the next person waiting.</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">View my events</a>
    <p class="signoff">See you there!<br><strong>Hasmik's Club</strong></p>
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
    <p>Your Hasmik's Club membership is now active — welcome! The best way to stay close to the community day-to-day is our private Telegram group, where members share updates, photos, and plan get-togethers between events.</p>
    <a href="{invite_url}" class="btn">Join Telegram Group →</a>
    <p class="small">This is a one-time invite link tied to your membership — please don't share it with anyone else.</p>
    """)
    send_async(to, name, "Welcome to Hasmik's Club — join us on Telegram", html)


def send_application_received(to: str, name: str) -> None:
    html = _wrap(f"""
    <h2>Application received, {name}!</h2>
    <p>Thank you so much for applying to join Hasmik's Club. Your application has landed safely with our team, and we'll take the time to review it carefully.</p>
    <p>You'll receive an email as soon as a decision has been made — we appreciate your patience in the meantime, and we're excited about the possibility of welcoming you into the community.</p>
    <p class="signoff">With warmth,<br><strong>The Hasmik's Club team</strong></p>
    """)
    send_async(to, name, "Application received — Hasmik's Club", html)


def send_application_approved(to: str, name: str) -> None:
    html = _wrap(f"""
    <h2>You're in, {name}! 🌸</h2>
    <p>Your application to join Hasmik's Club has been approved — welcome to our community! We're so glad to have you with us.</p>
    <p>Head to your dashboard to complete your profile, browse upcoming events, and start exploring everything membership includes.</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Go to my dashboard</a>
    <p class="signoff">With love,<br><strong>The Hasmik's Club team</strong></p>
    """)
    send_async(to, name, "You've been approved — Hasmik's Club 🌸", html)


def send_application_declined(to: str, name: str) -> None:
    html = _wrap(f"""
    <h2>Thank you for your interest, {name}</h2>
    <p>We really appreciate you taking the time to apply to Hasmik's Club. After careful consideration, we're not able to offer you a spot at this time.</p>
    <p>This isn't necessarily the end of the road — our community continues to grow, and we hope there may be an opportunity to welcome you in the future.</p>
    <p class="signoff">With warmth,<br><strong>The Hasmik's Club team</strong></p>
    """)
    send_async(to, name, "Regarding your Hasmik's Club application", html)


def send_password_reset(to: str, name: str, reset_url: str) -> None:
    html = _wrap(f"""
    <h2>Reset your password</h2>
    <p>Hi {name}, we received a request to reset the password on your Hasmik's Club account. Click below to choose a new one:</p>
    <a href="{reset_url}" class="btn">Reset Password</a>
    <p class="small">This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password will stay unchanged.</p>
    """)
    send_async(to, name, "Reset your Hasmik's Club password", html)
