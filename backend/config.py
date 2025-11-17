import os
from functools import lru_cache


class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./bookclub.db")
    admin_secret: str = os.getenv("ADMIN_SECRET", "letmein")
    allow_origins: list[str] = os.getenv("CORS_ORIGINS", "*").split(",")


@lru_cache
def get_settings() -> Settings:
    return Settings()
