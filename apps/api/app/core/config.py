from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="allow")

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/smarttag"

    # App
    app_name: str = "PolyAero Cathay SmartTag API"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    frontend_url: str = "http://localhost:8081"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:8081", "exp://localhost:8081"]

    # Auth
    secret_key: str = "dev-secret-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30


@lru_cache
def get_settings() -> Settings:
    return Settings()
