from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Workshop Inventory"
    app_mode: str = "dev"  # dev|prod

    postgres_db: str = "inventory"
    postgres_user: str = "inventory"
    postgres_password: str = "inventory"
    postgres_host: str = "db"
    postgres_port: int = 5432

    jwt_secret: str = "change_me_super_secret"
    jwt_expire_minutes: int = 1440

    admin_username: str = "admin"
    admin_password: str = "admin123"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
