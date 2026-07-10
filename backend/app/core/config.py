from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 129600  # 90 days — members stay signed in as long as possible
    ADMIN_EMAIL: str = ""
    API_BASE_URL: str = "https://hasmiks-club.onrender.com"  # this backend's own public URL

    # Google Sign-In — Client ID is not secret (it's sent to the browser regardless)
    GOOGLE_CLIENT_ID: str = ""

    # Brevo — CRM contact sync only (transactional email now goes through Resend)
    BREVO_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = ""
    BREVO_SENDER_NAME: str = "Hasmik's Club"
    BREVO_LIST_ID: int = 0  # Brevo contact list ID for members

    # Resend — transactional email (welcome, RSVP, verification, broadcasts, etc.)
    RESEND_API_KEY: str = ""
    RESEND_SENDER_EMAIL: str = "onboarding@resend.dev"  # replace once a domain is verified in Resend
    RESEND_SENDER_NAME: str = "Hasmik's Club"

    # Telegram
    TELEGRAM_INVITE_URL: str = ""
    TELEGRAM_BOT_USERNAME: str = ""  # not secret — the login widget needs it client-side
    TELEGRAM_BOT_TOKEN: str = ""  # secret — used server-side to verify login widget payloads

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Giphy (forum GIF picker) — free key from developers.giphy.com
    GIPHY_API_KEY: str = ""

    # Web Push (browser push notifications) — VAPID keypair, generate with
    # `vapid --gen` (py-vapid, a pywebpush dependency). PUBLIC_KEY is not
    # secret (sent to the browser as the pushManager.subscribe applicationServerKey).
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:hello@hasmiksclub.am"  # contact URI required by the Web Push spec

    # Sentry — error tracking, disabled unless a DSN is set
    SENTRY_DSN: str = ""
    ENVIRONMENT: str = "production"

    # Ameriabank vPOS (https://servicestest.ameriabank.am for the test environment)
    AMERIABANK_CLIENT_ID: str = ""
    AMERIABANK_USERNAME: str = ""
    AMERIABANK_PASSWORD: str = ""
    AMERIABANK_BASE_URL: str = "https://servicestest.ameriabank.am/VPOS"
    AMERIABANK_CURRENCY: str = "051"  # AMD
    AMERIABANK_MEMBERSHIP_AMOUNT: float = 40000  # AMD — real membership price (֏40,000/month)
    AMERIABANK_ORDER_ID_START: int = 30364001
    AMERIABANK_ORDER_ID_END: int = 30365000
    AMERIABANK_TEST_MODE: bool = True
    AMERIABANK_TEST_AMOUNT: float = 10  # AMD — bank's required test amount while AMERIABANK_TEST_MODE=True
    AMERIABANK_BACK_URL: str = "https://hasmiks-club.onrender.com/payments/callback"
    AMERIABANK_SUCCESS_URL: str = "https://www.hasmiksclub.am/dashboard"
    AMERIABANK_CANCEL_URL: str = "https://www.hasmiksclub.am/events"
    # One-time guest event tickets — a guest has no dashboard to land on, so
    # both routes go back to the public events page instead.
    AMERIABANK_GUEST_BACK_URL: str = "https://hasmiks-club.onrender.com/events/guest-checkout/callback"
    AMERIABANK_GUEST_SUCCESS_URL: str = "https://www.hasmiksclub.am/events"
    AMERIABANK_GUEST_CANCEL_URL: str = "https://www.hasmiksclub.am/events"

    class Config:
        env_file = ".env"


settings = Settings()
