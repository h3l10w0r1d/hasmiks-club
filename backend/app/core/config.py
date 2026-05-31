from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    ADMIN_EMAIL: str = ""

    # Brevo CRM
    BREVO_API_KEY: str = ""
    BREVO_SENDER_EMAIL: str = ""
    BREVO_SENDER_NAME: str = "Hasmik's Club"
    BREVO_LIST_ID: int = 0  # Brevo contact list ID for members

    # Telegram
    TELEGRAM_INVITE_URL: str = ""

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_ID: str = ""
    STRIPE_SUCCESS_URL: str = "https://hasmiks.club/dashboard"
    STRIPE_CANCEL_URL: str = "https://hasmiks.club/events"

    class Config:
        env_file = ".env"


settings = Settings()
