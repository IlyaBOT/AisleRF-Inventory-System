from __future__ import annotations

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # pydantic-settings читает .env автоматически, если указать env_file
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore")

    app_mode: str = "prod"  # dev/prod

    # Async SQLAlchemy URL
    database_url: str = "postgresql+asyncpg://postgres:postgres@db:5432/aislerf"

    # JWT
    jwt_secret: str = "change-me"
    jwt_exp_minutes: int = 60 * 24 * 7

    # CORS (через запятую)
    cors_origins: str = "http://localhost:5173,http://localhost:8080"

    # bootstrap admin (первый запуск)
    admin_username: str = "admin"
    admin_password: str = "admin123"  # держи <=72 bytes (bcrypt лимит)

    @property
    def cors_origins_list(self) -> List[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]


settings = Settings()
