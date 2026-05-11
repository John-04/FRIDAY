from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    # Paycrest API
    paycrest_api_key: str = ""
    paycrest_base_url: str = "https://api.paycrest.io/v1"
    noblocks_rates_url: str = "https://api.noblocks.xyz/rates"

    # App
    environment: str = "development"
    debug: bool = True
    port: int = 8000

    # ML
    model_path: Path = BASE_DIR / "data" / "models"
    data_path: Path = BASE_DIR / "data"
    retrain_interval_hours: int = 24
    min_samples_for_retrain: int = 1000

    # CORS
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    # Auth — comma-separated API keys for protecting /api/* endpoints
    # Leave empty in development for open access
    # Example: API_KEYS=key-abc123,key-def456
    api_keys: str = ""

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def api_keys_list(self) -> list[str]:
        if not self.api_keys:
            return []
        return [k.strip() for k in self.api_keys.split(",") if k.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
