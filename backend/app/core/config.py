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
    AMERIABANK_SUCCESS_URL: str = "https://hasmiks.club/dashboard"
    AMERIABANK_CANCEL_URL: str = "https://hasmiks.club/events"

    class Config:
        env_file = ".env"


settings = Settings()
