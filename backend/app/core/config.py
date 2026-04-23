"""Application configuration from environment variables."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Sistema Segmentacion Especies"
    APP_VERSION: str = "4.0.0"
    COMPANY_NAME: str = "Garces Fruit"
    CURRENT_SEASON: str = "2024-2025"
    DEBUG: bool = False
    ENV: str = "dev"  # "dev" | "staging" | "production" — gates destructive ops

    # Database - SQL Server Azure
    DB_SERVER: str = "tcp:valuedata.database.windows.net,1433"
    DB_NAME: str = "valuedatadev_2026-01-29T01-40Z"
    DB_USER: str = ""
    DB_PASSWORD: str = ""
    DB_DRIVER: str = "ODBC Driver 17 for SQL Server"

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours default
    # S-10: TTL diferenciado por rol. Admin más corto = menor blast-radius
    # si se compromete un token privilegiado.
    JWT_EXPIRE_MINUTES_ADMIN: int = 240  # 4 hours
    JWT_EXPIRE_MINUTES_DEFAULT: int = 720  # 12 hours

    # CORS
    CORS_ORIGINS: str = "http://localhost:3100,http://localhost:5173,http://localhost:3000"

    # Quality thresholds (defaults)
    BRIX_MIN: float = 14.0
    BRIX_MAX: float = 22.0
    FIRMEZA_MIN: float = 60.0
    FIRMEZA_MAX: float = 85.0
    ACIDEZ_MIN: float = 0.4
    ACIDEZ_MAX: float = 1.2
    CALIBRE_OPTIMO: float = 28.0

    # Azure OpenAI
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_DEPLOYMENT: str = "gpt-4o"
    AZURE_OPENAI_API_VERSION: str = "2024-12-01-preview"

    # Alerts
    DAYS_WITHOUT_REGISTRY_WARNING: int = 7
    LOW_STOCK_THRESHOLD_PCT: float = 20.0

    @property
    def database_url(self) -> str:
        params = (
            f"DRIVER={{{self.DB_DRIVER}}};"
            f"SERVER={self.DB_SERVER};"
            f"DATABASE={self.DB_NAME};"
            f"UID={self.DB_USER};"
            f"PWD={self.DB_PASSWORD};"
            "Encrypt=yes;"
            "TrustServerCertificate=no;"
            "Connection Timeout=30;"
        )
        return f"mssql+pyodbc:///?odbc_connect={params}"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
