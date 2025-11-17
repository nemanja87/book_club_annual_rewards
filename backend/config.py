import os
from functools import lru_cache


class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./bookclub.db")
    admin_secret: str = os.getenv("ADMIN_SECRET", "letmein")
    allow_origins: list[str] = [origin.strip().rstrip("/") for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin]


@lru_cache
def get_settings() -> Settings:
    return Settings()
