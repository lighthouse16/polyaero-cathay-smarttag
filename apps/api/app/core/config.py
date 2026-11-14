from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="allow")

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/smarttag"
    database_ssl_ca_file: str | None = None

    # App
    app_name: str = "PolyAero Cathay SmartTag API"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    frontend_url: str = "http://localhost:8081"

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:8081",
        "exp://localhost:8081",
    ]

    # Auth
    secret_key: str = "dev-secret-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    # Verification codes (OTP)
    otp_length: int = 6
    otp_ttl_seconds: int = 600
    otp_max_attempts: int = 5
    otp_resend_cooldown_seconds: int = 60

    # Email verification (SMTP with implicit TLS and an app password)
    smtp_host: str = Field(default="smtp.gmail.com", min_length=1)
    smtp_port: int = Field(default=465, ge=1, le=65535)
    smtp_username: str | None = None
    smtp_app_password: SecretStr | None = None

    # WebAuthn / passkeys
    webauthn_rp_id: str = "localhost"
    webauthn_rp_name: str = "PolyAero Cathay SmartTag"
    webauthn_origin: str = "http://localhost:8081"

    # IoT bridge (ESP32 PN532 reader)
    iot_device_key: str | None = None
    flight_status_staff_key: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
