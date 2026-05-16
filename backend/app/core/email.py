import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings


def _send(to: str, subject: str, html: str) -> None:
    if not settings.SMTP_HOST or not settings.EMAIL_FROM:
        return
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAIL_FROM, to, msg.as_string())
    except Exception:
        pass


def send_async(to: str, subject: str, html: str) -> None:
    threading.Thread(target=_send, args=(to, subject, html), daemon=True).start()


def send_welcome(to: str, name: str) -> None:
    send_async(to, "Welcome to Hasmik's Club! 🌸", f"""
    <h2>Welcome, {name}!</h2>
    <p>We're so happy you joined Hasmik's Club — a warm community for Armenian women.</p>
    <p>Your account is ready. <a href="https://hasmiks-club.vercel.app/dashboard">Visit your dashboard</a> to explore events and content.</p>
    <p>With love,<br>Hasmik's Club team</p>
    """)


def send_rsvp_confirmation(to: str, name: str, event_title: str, event_date: str, location: str) -> None:
    send_async(to, f"RSVP Confirmed: {event_title}", f"""
    <h2>You're in, {name}!</h2>
    <p>Your spot for <strong>{event_title}</strong> is confirmed.</p>
    <p>📍 <strong>Location:</strong> {location}<br>
    🗓 <strong>Date:</strong> {event_date}</p>
    <p>We look forward to seeing you!<br>Hasmik's Club</p>
    """)


def send_rsvp_cancelled(to: str, name: str, event_title: str) -> None:
    send_async(to, f"RSVP Cancelled: {event_title}", f"""
    <h2>Hi {name},</h2>
    <p>Your RSVP for <strong>{event_title}</strong> has been cancelled.</p>
    <p>You can always re-register if plans change. <a href="https://hasmiks-club.vercel.app/dashboard">Visit your dashboard</a>.</p>
    <p>Hasmik's Club</p>
    """)


def send_event_reminder(to: str, name: str, event_title: str, event_date: str, location: str) -> None:
    send_async(to, f"Reminder: {event_title} is tomorrow!", f"""
    <h2>See you tomorrow, {name}!</h2>
    <p>Just a reminder that <strong>{event_title}</strong> is happening tomorrow.</p>
    <p>📍 <strong>Location:</strong> {location}<br>
    🗓 <strong>Date:</strong> {event_date}</p>
    <p>Hasmik's Club</p>
    """)


def send_password_reset(to: str, name: str, reset_url: str) -> None:
    send_async(to, "Reset your Hasmik's Club password", f"""
    <h2>Hi {name},</h2>
    <p>We received a request to reset your password.</p>
    <p><a href="{reset_url}" style="background:#c0394b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Reset Password</a></p>
    <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    <p>Hasmik's Club</p>
    """)
