"""
All outbound email + Brevo CRM contact management.
Uses Brevo's REST API directly via httpx — no SDK needed.
"""
import threading
import httpx
from app.core.config import settings

_BREVO = "https://api.brevo.com/v3"


def _headers() -> dict:
    return {
        "api-key": settings.BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


# ── transactional email ────────────────────────────────────────────────────────

def _send(to_email: str, to_name: str, subject: str, html: str) -> None:
    if not settings.BREVO_API_KEY or not settings.BREVO_SENDER_EMAIL:
        return
    payload = {
        "sender": {"name": settings.BREVO_SENDER_NAME, "email": settings.BREVO_SENDER_EMAIL},
        "to": [{"email": to_email, "name": to_name}],
        "subject": subject,
        "htmlContent": html,
    }
    try:
        httpx.post(f"{_BREVO}/smtp/email", json=payload, headers=_headers(), timeout=10)
    except Exception:
        pass


def send_async(to_email: str, to_name: str, subject: str, html: str) -> None:
    threading.Thread(target=_send, args=(to_email, to_name, subject, html), daemon=True).start()


# ── contact management ─────────────────────────────────────────────────────────

def _sync_contact(email: str, name: str, membership_status: str) -> None:
    if not settings.BREVO_API_KEY:
        return
    parts = name.split(" ", 1)
    payload: dict = {
        "email": email,
        "attributes": {
            "FIRSTNAME": parts[0],
            "LASTNAME": parts[1] if len(parts) > 1 else "",
            "MEMBERSHIP_STATUS": membership_status,
        },
        "updateEnabled": True,
    }
    if settings.BREVO_LIST_ID:
        payload["listIds"] = [settings.BREVO_LIST_ID]
    try:
        httpx.post(f"{_BREVO}/contacts", json=payload, headers=_headers(), timeout=10)
    except Exception:
        pass


def sync_contact_async(email: str, name: str, membership_status: str) -> None:
    threading.Thread(target=_sync_contact, args=(email, name, membership_status), daemon=True).start()


def update_contact_status(email: str, membership_status: str) -> None:
    """Update membership status attribute on an existing Brevo contact."""
    if not settings.BREVO_API_KEY:
        return
    def _do():
        try:
            httpx.put(
                f"{_BREVO}/contacts/{email}",
                json={"attributes": {"MEMBERSHIP_STATUS": membership_status}},
                headers=_headers(),
                timeout=10,
            )
        except Exception:
            pass
    threading.Thread(target=_do, daemon=True).start()


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
