"""
All outbound transactional email (via Resend) + Brevo CRM contact/event sync.
Both talk to their REST APIs directly via httpx — no SDKs needed.
"""
import html
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
# clients strip inline base64 images from HTML mail (see qr_image_url above
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
  .lang-sep { height: 1px; background: #EFE1C8; margin: 26px 0; }
</style>
"""


def _e(value: Optional[str]) -> Optional[str]:
    """Escape a value before it's interpolated into one of these f-string
    HTML templates. Several of these fields (member full_name, gift
    giver/recipient names) ultimately trace back to self-service or
    unauthenticated input (e.g. the public /gift/start endpoint), so
    without this an attacker could inject arbitrary HTML/links into a
    transactional email sent to themselves, another member, or a
    non-member gift recipient."""
    return html.escape(value) if value else value


def _bilingual(hy: str, en: str) -> str:
    """Stack the Armenian version of an email above the English one, separated
    by a thin rule. Every transactional email goes out bilingual (Armenian
    first, matching the site's default language and its 50+ Armenian-women
    audience) so it reads regardless of the recipient's language — important
    for guests and gift recipients whose language preference we don't know."""
    return f"{hy}\n<div class=\"lang-sep\"></div>\n{en}"


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
        <p>© {year} Hasmik's Club. Բոլոր իրավունքները պաշտպանված են։ · All rights reserved.</p>
        <p>Դուք ստանում եք այս նամակը, քանի որ Hasmik's Club-ի ակումբի մասն եք՝ հայ կանանց ջերմ շրջապատ, կառուցված ջերմության, կապի և ընդհանուր մշակույթի շուրջ։</p>
        <p>You're receiving this email because you're part of Hasmik's Club — a circle of Armenian women built on warmth, connection, and shared culture.</p>
      </div></div>
    </div></body></html>"""


def send_welcome(to: str, name: str) -> None:
    name = _e(name)
    html = _wrap(_bilingual(f"""
    <h2>Բարի գալուստ, {name}! 🌸</h2>
    <p>Ուրախ ենք, որ միացաք Hasmik's Club-ին՝ ջերմ ու մտերմիկ ակումբ, ստեղծված հայ կանանց համար՝ հանդիպելու, շփվելու և մեր ընդհանուր մշակույթը միասին տոնելու։</p>
    <p>Ձեր հաշիվը պատրաստ է։ Ձեր վահանակում կգտնեք առաջիկա հանդիպումներ, որոնց կարող եք գրանցվել, բացառիկ բովանդակության աճող գրադարան և ակումբի մյուս անդամներին ծանոթանալու ցուցակ։</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Դեպի իմ վահանակ</a>
    <p class="small">Եթե հարցեր ունեք կամ պարզապես ուզում եք բարևել, մեր թիմը միշտ ուրախ է լսել ձեզնից։</p>
    <p class="signoff">Սիրով՝<br><strong>Hasmik's Club-ի թիմը</strong></p>
    """, f"""
    <h2>Welcome, {name}! 🌸</h2>
    <p>We're so happy you joined Hasmik's Club — a warm, intimate club built for Armenian women to gather, connect, and celebrate our shared culture together.</p>
    <p>Your account is ready to go. Inside your dashboard you'll find upcoming events to RSVP for, a growing library of exclusive content, and a directory to meet the rest of our club.</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Go to my dashboard</a>
    <p class="small">If you ever have questions or just want to say hello, our team is always happy to hear from you.</p>
    <p class="signoff">With love,<br><strong>The Hasmik's Club team</strong></p>
    """))
    send_async(to, name, "Բարի գալուստ Hasmik's Club 🌸 · Welcome to Hasmik's Club", html)


def send_rsvp_confirmation(to: str, name: str, event_title: str, event_date: str, location: str) -> None:
    name, event_title, location = _e(name), _e(event_title), _e(location)
    html = _wrap(_bilingual(f"""
    <h2>Դուք գրանցված եք, {name}! ✅</h2>
    <p>Ձեր տեղը «<strong>{event_title}</strong>»-ի համար պաշտոնապես ամրագրված է. անհամբեր սպասում ենք ձեզ։</p>
    <div class="meta">
      <p>📍 <strong>Վայր՝</strong> {location}</p>
      <p>🗓 <strong>Ամսաթիվ՝</strong> {event_date}</p>
    </div>
    <p>Պլանները փոխվում են. եթե ինչ-որ բան պատահի, կարող եք ցանկացած պահի չեղարկել ձեր գրանցումը վահանակից՝ որպեսզի տեղը առաջարկենք սպասման ցուցակից որևէ մեկին։</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Իմ հանդիպումները</a>
    <p class="signoff">Անհամբեր սպասում ենք ձեզ։<br><strong>Hasmik's Club</strong></p>
    """, f"""
    <h2>You're confirmed, {name}! ✅</h2>
    <p>Your spot for <strong>{event_title}</strong> is officially reserved — we can't wait to spend the evening with you.</p>
    <div class="meta">
      <p>📍 <strong>Location:</strong> {location}</p>
      <p>🗓 <strong>Date:</strong> {event_date}</p>
    </div>
    <p>Plans change — if something comes up, you can cancel your RSVP anytime from your dashboard so we can offer your spot to someone on the waitlist.</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">View my events</a>
    <p class="signoff">We look forward to seeing you there!<br><strong>Hasmik's Club</strong></p>
    """))
    send_async(to, name, f"Գրանցումը հաստատված է · RSVP Confirmed: {event_title}", html)


def qr_image_url(payload: str) -> Optional[str]:
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
    name, event_title = _e(name), _e(event_title)
    html = _wrap(_bilingual(f"""
    <h2>Հաստատեք ձեր էլ. հասցեն, {name}</h2>
    <p>Ընդամենը մեկ քայլ է մնացել «<strong>{event_title}</strong>»-ի ձեր տոմսին։ Մուտքագրեք այս 6 նիշանոց կոդը վճարման էջում՝ հաստատելու, որ դա իսկապես դուք եք, և շարունակելու դեպի վճարում.</p>
    <div class="meta" style="text-align:center;">
      <p style="font-size:32px;font-weight:700;letter-spacing:0.3em;color:#7E3434;margin:0;">{code}</p>
    </div>
    <p class="small">Այս կոդը գործում է 10 րոպե։ Եթե դուք չեք դիմել, կարող եք անտեսել այս նամակը՝ առանց դրա ոչ մի տոմս կամ գանձում չի լինի։</p>
    """, f"""
    <h2>Confirm your email, {name}</h2>
    <p>You're one step away from your ticket for <strong>{event_title}</strong>. Enter this 6-digit code on the checkout page to confirm it's really you and continue to payment:</p>
    <div class="meta" style="text-align:center;">
      <p style="font-size:32px;font-weight:700;letter-spacing:0.3em;color:#7E3434;margin:0;">{code}</p>
    </div>
    <p class="small">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email — no ticket or charge will happen without it.</p>
    """))
    send_async(to, name, f"Ձեր հաստատման կոդը · Your verification code: {code}", html)


def send_guest_ticket_confirmation(to: str, name: str, event_title: str, event_date: str, location: str, checkin_payload: Optional[str] = None) -> None:
    name, event_title, location = _e(name), _e(event_title), _e(location)
    qr_html = ""
    if checkin_payload:
        qr_url = qr_image_url(checkin_payload)
        if qr_url:
            qr_html = f"""
            <div style="text-align:center;margin:24px 0;">
              <img src="{qr_url}" alt="Check-in QR code" width="200" height="200" style="width:200px;height:200px;border:8px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,.1);" />
              <p class="small" style="margin-top:8px;">Ցույց տվեք այս QR կոդը մուտքի մոտ. տպելու կարիք չկա, հեռախոսի էկրանը լիովին բավական է։ · Show this QR code at the door — no need to print it, your phone screen works just fine.</p>
            </div>
            """
    html = _wrap(_bilingual(f"""
    <h2>Դուք մեզ հետ եք, {name}! 🎟️</h2>
    <p>«<strong>{event_title}</strong>»-ի ձեր մեկանգամյա տոմսը հաստատված է. անդամակցություն պետք չէ, պարզապես եկեք և վայելեք երեկոն։</p>
    <div class="meta">
      <p>📍 <strong>Վայր՝</strong> {location}</p>
      <p>🗓 <strong>Ամսաթիվ՝</strong> {event_date}</p>
    </div>
    {qr_html}
    <p>Պահեք այս նամակը. վերևի QR կոդով է մեր թիմը ձեզ մուտք գրանցելու մուտքի մոտ, այնպես որ առանձին տպագիր կամ անձնագրի ստուգում պետք չէ։</p>
    <p class="signoff">Անհամբեր սպասում ենք ձեզ։<br><strong>Hasmik's Club</strong></p>
    """, f"""
    <h2>You're in, {name}! 🎟️</h2>
    <p>Your one-time ticket for <strong>{event_title}</strong> is confirmed — no membership needed, just show up and enjoy the evening.</p>
    <div class="meta">
      <p>📍 <strong>Location:</strong> {location}</p>
      <p>🗓 <strong>Date:</strong> {event_date}</p>
    </div>
    <p>Hold on to this email — your QR code above is what our team will scan you in with at the door, so no separate printout or ID check is needed.</p>
    <p class="signoff">We look forward to seeing you there!<br><strong>Hasmik's Club</strong></p>
    """))
    send_async(to, name, f"Տոմսը հաստատված է · Ticket Confirmed: {event_title}", html)


def send_rsvp_cancelled(to: str, name: str, event_title: str) -> None:
    name, event_title = _e(name), _e(event_title)
    html = _wrap(_bilingual(f"""
    <h2>Գրանցումը չեղարկվեց</h2>
    <p>Բարև, {name}։ «<strong>{event_title}</strong>»-ի ձեր գրանցումը չեղարկվել է ըստ ձեր խնդրանքի, և ձեր տեղն ազատվել է խմբի համար։</p>
    <p>Հուսով ենք՝ կմիանաք մեզ հաջորդ հանդիպմանը. նոր միջոցառումներ պարբերաբար ավելանում են, և ուրախ կլինենք տեսնել ձեզ։</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Դիտել առաջիկա հանդիպումները</a>
    """, f"""
    <h2>RSVP cancelled</h2>
    <p>Hi {name}, your RSVP for <strong>{event_title}</strong> has been cancelled as requested, and your spot has been released back to the group.</p>
    <p>We hope you can join us at a future gathering — new events go up regularly, and we'd love to see you there.</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Browse upcoming events</a>
    """))
    send_async(to, name, f"Գրանցումը չեղարկվեց · RSVP Cancelled: {event_title}", html)


def send_event_reminder(to: str, name: str, event_title: str, event_date: str, location: str) -> None:
    name, event_title, location = _e(name), _e(event_title), _e(location)
    html = _wrap(_bilingual(f"""
    <h2>Կտեսնվենք վաղը, {name}! 🌺</h2>
    <p>Ընդամենը ընկերական հիշեցում, որ «<strong>{event_title}</strong>»-ը կայանալու է վաղը. անհամբեր սպասում ենք հրաշալի երեկոյի միասին։</p>
    <div class="meta">
      <p>📍 <strong>Վայր՝</strong> {location}</p>
      <p>🗓 <strong>Ամսաթիվ՝</strong> {event_date}</p>
    </div>
    <p>Եթե ձեր պլանները փոխվել են, և այլևս չեք կարող գալ, խնդրում ենք չեղարկել գրանցումը վահանակից՝ որպեսզի տեղը առաջարկենք սպասման ցուցակից որևէ մեկին։</p>
    <p class="signoff">Անհամբեր սպասում ենք ձեզ։<br><strong>Hasmik's Club</strong></p>
    """, f"""
    <h2>See you tomorrow, {name}! 🌺</h2>
    <p>Just a friendly reminder that <strong>{event_title}</strong> is happening tomorrow — we're looking forward to a wonderful evening together.</p>
    <div class="meta">
      <p>📍 <strong>Location:</strong> {location}</p>
      <p>🗓 <strong>Date:</strong> {event_date}</p>
    </div>
    <p>If your plans have changed and you can no longer make it, please cancel your RSVP from your dashboard so we can offer the spot to someone on the waitlist.</p>
    <p class="signoff">We can't wait to see you!<br><strong>Hasmik's Club</strong></p>
    """))
    send_async(to, name, f"Վաղը · Tomorrow: {event_title} 🗓", html)


def send_verification(to: str, name: str, verify_url: str) -> None:
    name = _e(name)
    html = _wrap(_bilingual(f"""
    <h2>Հաստատեք ձեր էլ. հասցեն, {name}։</h2>
    <p>Շնորհակալություն Hasmik's Club-ին միանալու համար։ Նախքան սկսելը՝ խնդրում ենք հաստատել, որ սա իսկապես ձեր էլ. հասցեն է. ընդամենը մեկ սեղմում է պետք։</p>
    <a href="{verify_url}" class="btn">Հաստատել իմ էլ. հասցեն</a>
    <p class="small">Այս հղումը գործում է 24 ժամ։ Եթե Hasmik's Club-ի հաշիվ չեք ստեղծել, կարող եք անտեսել այս նամակը։</p>
    """, f"""
    <h2>Verify your email, {name}!</h2>
    <p>Thanks so much for joining Hasmik's Club. Before you can dive in, please confirm this is really your email address — it only takes one click.</p>
    <a href="{verify_url}" class="btn">Verify my email</a>
    <p class="small">This link expires in 24 hours. If you didn't create a Hasmik's Club account, you can safely ignore this email.</p>
    """))
    send_async(to, name, "Հաստատեք ձեր էլ. հասցեն · Please verify your email — Hasmik's Club", html)


def send_waitlist_joined(to: str, name: str, event_title: str, position: int) -> None:
    name, event_title = _e(name), _e(event_title)
    html = _wrap(_bilingual(f"""
    <h2>Դուք սպասման ցուցակում եք, {name}։</h2>
    <p>«<strong>{event_title}</strong>»-ն այս պահին լցված է, բայց դուք ապահով տեղում եք՝ սպասման ցուցակի <strong>#{position}</strong> դիրքում։</p>
    <p>Հենց տեղ ազատվի, ձեզ ավտոմատ կգրանցենք և անմիջապես նամակ կուղարկենք. կրկին ստուգելու կարիք չկա։</p>
    """, f"""
    <h2>You're on the waitlist, {name}!</h2>
    <p><strong>{event_title}</strong> is currently full, but you're all set at position <strong>#{position}</strong> on the waitlist.</p>
    <p>The moment a spot opens up, you'll be automatically registered and we'll email you right away — no need to keep checking back.</p>
    """))
    send_async(to, name, f"Սպասման ցուցակ #{position} · Waitlist #{position}: {event_title}", html)


def send_waitlist_promoted(to: str, name: str, event_title: str, event_date: str, location: str) -> None:
    name, event_title, location = _e(name), _e(event_title), _e(location)
    html = _wrap(_bilingual(f"""
    <h2>Հիանալի նորություն, {name}! Տեղ ազատվեց 🎉</h2>
    <p>«<strong>{event_title}</strong>»-ի համար տեղ ազատվեց, և դուք ավտոմատ տեղափոխվել եք սպասման ցուցակից ու գրանցվել. ձեզնից գործողություն պետք չէ։</p>
    <div class="meta">
      <p>📍 <strong>Վայր՝</strong> {location}</p>
      <p>🗓 <strong>Ամսաթիվ՝</strong> {event_date}</p>
    </div>
    <p>Եթե ինչ-որ բան պատահել է, և այլևս չեք կարող մասնակցել, խնդրում ենք տեղեկացնել՝ չեղարկելով ձեր գրանցումը, որպեսզի տեղը անցնի հաջորդ սպասողին։</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Իմ հանդիպումները</a>
    <p class="signoff">Կտեսնվենք։<br><strong>Hasmik's Club</strong></p>
    """, f"""
    <h2>Great news, {name}! A spot opened up 🎉</h2>
    <p>A seat for <strong>{event_title}</strong> just became available, and you've been automatically moved off the waitlist and registered — no action needed from you.</p>
    <div class="meta">
      <p>📍 <strong>Location:</strong> {location}</p>
      <p>🗓 <strong>Date:</strong> {event_date}</p>
    </div>
    <p>If something's come up and you can no longer attend, please let us know by cancelling your RSVP so the spot can go to the next person waiting.</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">View my events</a>
    <p class="signoff">See you there!<br><strong>Hasmik's Club</strong></p>
    """))
    send_async(to, name, f"Տեղ ազատվեց · You're in! Spot opened for {event_title}", html)


def send_broadcast(to: str, name: str, subject: str, body: str) -> None:
    paragraphs = "".join(f"<p>{line}</p>" for line in body.strip().split("\n") if line.strip())
    html = _wrap(f"""
    <h2>{subject}</h2>
    {paragraphs}
    """)
    send_async(to, name, subject, html)


def send_telegram_invite(to: str, name: str, invite_url: str) -> None:
    name = _e(name)
    html = _wrap(_bilingual(f"""
    <h2>Դուք մեզ հետ եք, {name}! 🎉</h2>
    <p>Ձեր Hasmik's Club-ի անդամակցությունն այժմ ակտիվ է՝ բարի գալուստ։ Ամեն օր ակումբին մոտ մնալու լավագույն ձևը մեր փակ Telegram խումբն է, որտեղ անդամները կիսվում են նորություններով, լուսանկարներով և հանդիպումների միջև հավաքներ պլանավորում։</p>
    <a href="{invite_url}" class="btn">Միանալ Telegram խմբին →</a>
    <p class="small">Սա ձեր անդամակցությանը կապված միանվագ հրավերի հղում է. խնդրում ենք չկիսվել ուրիշների հետ։</p>
    """, f"""
    <h2>You're in, {name}! 🎉</h2>
    <p>Your Hasmik's Club membership is now active — welcome! The best way to stay close to the club day-to-day is our private Telegram group, where members share updates, photos, and plan get-togethers between events.</p>
    <a href="{invite_url}" class="btn">Join Telegram Group →</a>
    <p class="small">This is a one-time invite link tied to your membership — please don't share it with anyone else.</p>
    """))
    send_async(to, name, "Բարի գալուստ Hasmik's Club — միացեք մեզ Telegram-ում · Join us on Telegram", html)


def send_application_received(to: str, name: str) -> None:
    name = _e(name)
    html = _wrap(_bilingual(f"""
    <h2>Դիմումը ստացվեց, {name}։</h2>
    <p>Շնորհակալ ենք Hasmik's Club-ին միանալու դիմումի համար։ Ձեր դիմումն ապահով հասել է մեր թիմին, և մենք ուշադիր կդիտարկենք այն։</p>
    <p>Հենց որ որոշում կայացվի, կստանաք նամակ։ Շնորհակալ ենք համբերության համար և ուրախ կլինենք ձեզ ընդունել ակումբ։</p>
    <p class="signoff">Ջերմությամբ՝<br><strong>Hasmik's Club-ի թիմը</strong></p>
    """, f"""
    <h2>Application received, {name}!</h2>
    <p>Thank you so much for applying to join Hasmik's Club. Your application has landed safely with our team, and we'll take the time to review it carefully.</p>
    <p>You'll receive an email as soon as a decision has been made — we appreciate your patience in the meantime, and we're excited about the possibility of welcoming you into the club.</p>
    <p class="signoff">With warmth,<br><strong>The Hasmik's Club team</strong></p>
    """))
    send_async(to, name, "Դիմումը ստացվեց · Application received — Hasmik's Club", html)


def send_application_approved(to: str, name: str) -> None:
    name = _e(name)
    html = _wrap(_bilingual(f"""
    <h2>Դուք ընդունված եք, {name}! 🌸</h2>
    <p>Hasmik's Club-ին միանալու ձեր դիմումը հաստատվել է՝ բարի գալուստ ակումբ։ Շատ ուրախ ենք, որ մեզ հետ եք։</p>
    <p>Անցեք ձեր վահանակ՝ լրացնելու ձեր պրոֆիլը, դիտելու առաջիկա հանդիպումները և բացահայտելու այն ամենը, ինչ ներառում է անդամակցությունը։</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Դեպի իմ վահանակ</a>
    <p class="signoff">Սիրով՝<br><strong>Hasmik's Club-ի թիմը</strong></p>
    """, f"""
    <h2>You're in, {name}! 🌸</h2>
    <p>Your application to join Hasmik's Club has been approved — welcome to the club! We're so glad to have you with us.</p>
    <p>Head to your dashboard to complete your profile, browse upcoming events, and start exploring everything membership includes.</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Go to my dashboard</a>
    <p class="signoff">With love,<br><strong>The Hasmik's Club team</strong></p>
    """))
    send_async(to, name, "Դուք ընդունված եք 🌸 · You've been approved — Hasmik's Club", html)


def send_application_declined(to: str, name: str) -> None:
    name = _e(name)
    html = _wrap(_bilingual(f"""
    <h2>Շնորհակալություն հետաքրքրության համար, {name}</h2>
    <p>Իսկապես գնահատում ենք, որ ժամանակ հատկացրիք Hasmik's Club-ին դիմելու համար։ Ուշադիր դիտարկումից հետո այս պահին չենք կարող ձեզ տեղ առաջարկել։</p>
    <p>Սա պարտադիր չէ, որ վերջն է. մեր ակումբը շարունակում է աճել, և հուսով ենք՝ ապագայում հնարավորություն կլինի ձեզ ընդունելու։</p>
    <p class="signoff">Ջերմությամբ՝<br><strong>Hasmik's Club-ի թիմը</strong></p>
    """, f"""
    <h2>Thank you for your interest, {name}</h2>
    <p>We really appreciate you taking the time to apply to Hasmik's Club. After careful consideration, we're not able to offer you a spot at this time.</p>
    <p>This isn't necessarily the end of the road — our club continues to grow, and we hope there may be an opportunity to welcome you in the future.</p>
    <p class="signoff">With warmth,<br><strong>The Hasmik's Club team</strong></p>
    """))
    send_async(to, name, "Ձեր դիմումի վերաբերյալ · Regarding your Hasmik's Club application", html)


def send_password_reset(to: str, name: str, reset_url: str) -> None:
    name = _e(name)
    html = _wrap(_bilingual(f"""
    <h2>Վերականգնեք ձեր գաղտնաբառը</h2>
    <p>Բարև, {name}։ Ստացել ենք ձեր Hasmik's Club-ի հաշվի գաղտնաբառը վերականգնելու հարցում։ Սեղմեք ստորև՝ նորը ընտրելու համար.</p>
    <a href="{reset_url}" class="btn">Վերականգնել գաղտնաբառը</a>
    <p class="small">Այս հղումը գործում է 1 ժամ։ Եթե դուք չեք դիմել, կարող եք անտեսել այս նամակը՝ ձեր գաղտնաբառը կմնա անփոփոխ։</p>
    """, f"""
    <h2>Reset your password</h2>
    <p>Hi {name}, we received a request to reset the password on your Hasmik's Club account. Click below to choose a new one:</p>
    <a href="{reset_url}" class="btn">Reset Password</a>
    <p class="small">This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password will stay unchanged.</p>
    """))
    send_async(to, name, "Վերականգնեք ձեր գաղտնաբառը · Reset your Hasmik's Club password", html)


# ── recurring membership billing ───────────────────────────────────────────────

def send_renewal_succeeded(to: str, name: str, amount: float) -> None:
    name = _e(name)
    html = _wrap(_bilingual(f"""
    <h2>Ամեն ինչ պատրաստ է, {name}! ✅</h2>
    <p>Ձեր Hasmik's Club-ի անդամակցությունը հենց նոր ավտոմատ երկարաձգվեց՝ ձեր քարտից գանձվեց ֏{amount:,.0f}, և ձեր հասանելիությունը շարունակվում է անխափան։</p>
    <p class="small">Կարող եք ցանկացած պահի դիտել ձեր վճարման մանրամասները կամ անջատել ավտոմատ երկարաձգումը ձեր վահանակից։</p>
    """, f"""
    <h2>You're all set, {name}! ✅</h2>
    <p>Your Hasmik's Club membership just renewed automatically — ֏{amount:,.0f} was charged to your card on file, and your access continues uninterrupted.</p>
    <p class="small">You can review your billing details or turn off auto-renew anytime from your dashboard.</p>
    """))
    send_async(to, name, "Ձեր անդամակցությունը երկարաձգվեց · Your membership renewed — Hasmik's Club", html)


def send_renewal_failed(to: str, name: str, attempts_left: int) -> None:
    name = _e(name)
    retry_hy = f"{attempts_left} անգամ" if attempts_left != 1 else "1 անգամ"
    html = _wrap(_bilingual(f"""
    <h2>Չկարողացանք երկարաձգել ձեր անդամակցությունը, {name}</h2>
    <p>Ձեր քարտը մերժվեց այս ամսվա անդամակցության երկարաձգման համար։ Մի քանի օրից նորից կփորձենք, բայց մինչ այդ չեք կարողանա գրանցվել նոր միջոցառումների, քանի դեռ խնդիրը չի լուծվել։</p>
    <p>Խնդրում ենք թարմացնել ձեր քարտը վահանակի վճարման բաժնից՝ խափանումից խուսափելու համար։</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Թարմացնել իմ քարտը</a>
    <p class="small">Մինչ ձեր անդամակցության դադարեցումը ևս {retry_hy} կփորձենք։</p>
    """, f"""
    <h2>We couldn't renew your membership, {name}</h2>
    <p>Your card on file was declined for this month's membership renewal. We'll try again in a few days, but in the meantime you won't be able to register for new events until it's resolved.</p>
    <p>Please update your card from your dashboard's billing section to avoid any interruption.</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Update my card</a>
    <p class="small">We'll retry {attempts_left} more time{'s' if attempts_left != 1 else ''} before your membership lapses.</p>
    """))
    send_async(to, name, "Գործողություն է պահանջվում · Action needed: your membership renewal failed", html)


def send_membership_lapsed(to: str, name: str) -> None:
    name = _e(name)
    html = _wrap(_bilingual(f"""
    <h2>Ձեր անդամակցությունը դադարեցվել է, {name}</h2>
    <p>Մի քանի փորձից հետո չկարողացանք երկարաձգել ձեր Hasmik's Club-ի անդամակցությունը, ուստի այն այժմ ապակտիվ է։ Ցանկացած պահի սիրով սպասում ենք ձեզ. պարզապես ավելացրեք քարտ ձեր վահանակից՝ վերսկսելու համար։</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Վերսկսել իմ անդամակցությունը</a>
    <p class="signoff">Ուրախ կլինենք ձեզ նորից տեսնել։<br><strong>Hasmik's Club</strong></p>
    """, f"""
    <h2>Your membership has lapsed, {name}</h2>
    <p>After a few attempts, we weren't able to renew your Hasmik's Club membership, so it's now inactive. You're welcome back anytime — just add a card from your dashboard to resume.</p>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Resume my membership</a>
    <p class="signoff">We'd love to have you back!<br><strong>Hasmik's Club</strong></p>
    """))
    send_async(to, name, "Ձեր անդամակցությունը դադարեցվել է · Your Hasmik's Club membership has lapsed", html)


# ── gift cards ──────────────────────────────────────────────────────────────

def send_gift_verification_code(to: str, name: str, code: str, recipient_name: str) -> None:
    name, recipient_name = _e(name), _e(recipient_name)
    html = _wrap(_bilingual(f"""
    <h2>Հաստատեք ձեր էլ. հասցեն, {name}</h2>
    <p>Ընդամենը մեկ քայլ է մնացել <strong>{recipient_name}</strong>-ին նվեր ուղարկելուն։ Մուտքագրեք այս 6 նիշանոց կոդը վճարման էջում՝ հաստատելու, որ դա իսկապես դուք եք, և շարունակելու դեպի վճարում.</p>
    <div class="meta" style="text-align:center;">
      <p style="font-size:32px;font-weight:700;letter-spacing:0.3em;color:#7E3434;margin:0;">{code}</p>
    </div>
    <p class="small">Այս կոդը գործում է 10 րոպե։ Եթե դուք չեք դիմել, կարող եք անտեսել այս նամակը՝ առանց դրա ոչ մի նվեր կամ գանձում չի լինի։</p>
    """, f"""
    <h2>Confirm your email, {name}</h2>
    <p>You're one step away from sending a gift to <strong>{recipient_name}</strong>. Enter this 6-digit code on the checkout page to confirm it's really you and continue to payment:</p>
    <div class="meta" style="text-align:center;">
      <p style="font-size:32px;font-weight:700;letter-spacing:0.3em;color:#7E3434;margin:0;">{code}</p>
    </div>
    <p class="small">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email — no gift or charge will happen without it.</p>
    """))
    send_async(to, name, f"Ձեր հաստատման կոդը · Your verification code: {code}", html)


def send_gift_giver_receipt(to: str, name: str, recipient_name: str, detail_line: str, amount) -> None:
    name, recipient_name, detail_line = _e(name), _e(recipient_name), _e(detail_line)
    html = _wrap(_bilingual(f"""
    <h2>Ձեր նվերը ճանապարհին է, {name}! 🎁</h2>
    <p>Շնորհակալություն <strong>{recipient_name}</strong>-ին նվեր անելու համար. ձեր վճարումը կատարվել է, և մենք արդեն կապվել ենք նրա հետ՝ մանրամասներով։</p>
    <div class="meta">
      <p><strong>Նվեր՝</strong> {detail_line}</p>
      <p><strong>Վճարված գումար՝</strong> ֏{amount:,.0f}</p>
      <p><strong>Ստացող՝</strong> {recipient_name}</p>
    </div>
    <p class="signoff">Ջերմությամբ՝<br><strong>Hasmik's Club-ի թիմը</strong></p>
    """, f"""
    <h2>Your gift is on its way, {name}! 🎁</h2>
    <p>Thank you for gifting <strong>{recipient_name}</strong> — your payment has gone through and we've reached out to them with the details.</p>
    <div class="meta">
      <p><strong>Gift:</strong> {detail_line}</p>
      <p><strong>Amount paid:</strong> ֏{amount:,.0f}</p>
      <p><strong>Recipient:</strong> {recipient_name}</p>
    </div>
    <p class="signoff">With warmth,<br><strong>The Hasmik's Club team</strong></p>
    """))
    send_async(to, name, "Ձեր նվերի անդորրագիրը · Your gift receipt — Hasmik's Club", html)


def send_gift_claim_link(to: str, recipient_name: str, giver_name: Optional[str], duration_months: int, claim_url: str) -> None:
    recipient_name, giver_name = _e(recipient_name), _e(giver_name)
    from_line_en = f"<strong>{giver_name}</strong> has gifted you" if giver_name else "You've been gifted"
    from_line_hy = f"<strong>{giver_name}</strong>-ը ձեզ նվիրել է" if giver_name else "Ձեզ նվիրվել է"
    html = _wrap(_bilingual(f"""
    <h2>Ձեզ համար նվեր կա, {recipient_name}! 🎁</h2>
    <p>{from_line_hy} <strong>{duration_months} ամիս</strong> Hasmik's Club-ի անդամակցություն՝ ջերմ ու մտերմիկ ակումբ հայ կանանց համար։</p>
    <p>Ստացեք այն ստորև՝ գաղտնաբառ ընտրելով, կամ Google-ով կամ Telegram-ով շարունակելով. կպահանջվի մեկ րոպեից պակաս։</p>
    <a href="{claim_url}" class="btn">Ստանալ իմ նվերը</a>
    <p class="small">Այս հղումը միայն ձերն է. կիսվելու կարիք չկա։</p>
    """, f"""
    <h2>A gift for you, {recipient_name}! 🎁</h2>
    <p>{from_line_en} <strong>{duration_months} month{'s' if duration_months != 1 else ''}</strong> of Hasmik's Club membership — a warm, intimate club for Armenian women.</p>
    <p>Claim it below by setting a password, or continuing with Google or Telegram — takes less than a minute.</p>
    <a href="{claim_url}" class="btn">Claim my gift</a>
    <p class="small">This link is yours alone — no need to share it with anyone.</p>
    """))
    send_async(to, recipient_name, "Դուք ստացել եք նվեր · You've received a gift — Hasmik's Club 🎁", html)


def send_gift_applied_existing(to: str, recipient_name: str, giver_name: Optional[str], duration_months: int, expires_at: str) -> None:
    recipient_name, giver_name = _e(recipient_name), _e(giver_name)
    from_line_en = f"<strong>{giver_name}</strong> has gifted you" if giver_name else "You've been gifted"
    from_line_hy = f"<strong>{giver_name}</strong>-ը ձեզ նվիրել է" if giver_name else "Ձեզ նվիրվել է"
    html = _wrap(_bilingual(f"""
    <h2>Ձեզ համար նվեր կա, {recipient_name}! 🎁</h2>
    <p>{from_line_hy} <strong>{duration_months} ամիս</strong> Hasmik's Club-ի անդամակցություն, և քանի որ դուք արդեն հաշիվ ունեք, այն արդեն ակտիվ է. գործողություն պետք չէ։</p>
    <div class="meta">
      <p><strong>Ակտիվ է մինչև՝</strong> {expires_at}</p>
    </div>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Դեպի իմ վահանակ</a>
    <p class="signoff">Ջերմությամբ՝<br><strong>Hasmik's Club-ի թիմը</strong></p>
    """, f"""
    <h2>A gift for you, {recipient_name}! 🎁</h2>
    <p>{from_line_en} <strong>{duration_months} month{'s' if duration_months != 1 else ''}</strong> of Hasmik's Club membership, and since you already have an account, it's already active — no action needed.</p>
    <div class="meta">
      <p><strong>Active until:</strong> {expires_at}</p>
    </div>
    <a href="https://www.hasmiksclub.am/dashboard" class="btn">Go to my dashboard</a>
    <p class="signoff">With warmth,<br><strong>The Hasmik's Club team</strong></p>
    """))
    send_async(to, recipient_name, "Դուք ստացել եք նվեր · You've received a gift — Hasmik's Club 🎁", html)


def send_gift_tickets(to: str, recipient_name: str, giver_name: Optional[str], tickets: list) -> None:
    """tickets: list of {event_title, event_date, location, qr_url}"""
    recipient_name, giver_name = _e(recipient_name), _e(giver_name)
    from_line_en = f"<strong>{giver_name}</strong> has gifted you" if giver_name else "You've been gifted"
    from_line_hy = f"<strong>{giver_name}</strong>-ը ձեզ նվիրել է" if giver_name else "Ձեզ նվիրվել է"
    n = len(tickets)
    tickets_en = "a ticket" if n == 1 else f"{n} tickets"
    events_en = "event" if n == 1 else "events"
    tickets_hy = "մեկ տոմս" if n == 1 else f"{n} տոմս"
    qr_word_hy = "QR կոդը" if n == 1 else "QR կոդերը"
    qr_word_en = "QR code" if n == 1 else "QR codes"
    cards = ""
    for t in tickets:
        qr_html = f"""
        <div style="text-align:center;margin:16px 0;">
          <img src="{t['qr_url']}" alt="Check-in QR code" width="180" height="180" style="width:180px;height:180px;border:8px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,.1);" />
        </div>
        """ if t.get("qr_url") else ""
        cards += f"""
        <div class="meta">
          <p style="font-size:16px;font-weight:600;margin-bottom:8px;">{_e(t['event_title'])}</p>
          <p>📍 <strong>Վայր · Location:</strong> {_e(t['location'])}</p>
          <p>🗓 <strong>Ամսաթիվ · Date:</strong> {t['event_date']}</p>
          {qr_html}
        </div>
        """
    # Cards (with QR) rendered once, between the bilingual intro and outro.
    body = f"""
    <h2>Ձեզ համար նվեր կա, {recipient_name}! 🎟️</h2>
    <p>{from_line_hy} {tickets_hy} ստորև նշված միջոցառման{'ների' if n != 1 else ''} համար. անդամակցություն պետք չէ, պարզապես եկեք և վայելեք։</p>
    <div class="lang-sep"></div>
    <h2>A gift for you, {recipient_name}! 🎟️</h2>
    <p>{from_line_en} {tickets_en} to the {events_en} below — no membership needed, just show up and enjoy.</p>
    {cards}
    <p>Պահեք այս նամակը. վերևի {qr_word_hy}ով է մեր թիմը ձեզ մուտք գրանցելու մուտքի մոտ, առանձին տպագիր պետք չէ։</p>
    <div class="lang-sep"></div>
    <p>Hold on to this email — the {qr_word_en} above are what our team will scan you in with at the door, no separate printout needed.</p>
    <p class="signoff">Անհամբեր սպասում ենք ձեզ · We look forward to seeing you there!<br><strong>Hasmik's Club</strong></p>
    """
    html = _wrap(body)
    send_async(to, recipient_name, "Դուք ստացել եք նվեր տոմս · You've received a gift ticket — Hasmik's Club 🎟️", html)
