# app/config.py
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# ---------------------------------------------------------------------------
# Absolute path to .env — works regardless of where uvicorn is launched from
# ---------------------------------------------------------------------------

_ENV_FILE: Path = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):

    # ── MongoDB ──────────────────────────────────────────────────────────────
    MONGODB_URI:   str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "greengo_db"

    # ── Gemini AI ────────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""

    # ── Twilio ───────────────────────────────────────────────────────────────
    TWILIO_ACCOUNT_SID:   str = ""
    TWILIO_AUTH_TOKEN:    str = ""
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"

    # ── Application ──────────────────────────────────────────────────────────
    APP_ENV:   str  = "development"
    APP_DEBUG: bool = False
    LOG_LEVEL: str  = "INFO"

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),          # absolute path — never wrong
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Validators — strip quotes/whitespace that corrupt API keys ───────────

    @field_validator("GEMINI_API_KEY", mode="before")
    @classmethod
    def strip_gemini_key(cls, v: str) -> str:
        return str(v).strip().strip('"').strip("'").strip()

    @field_validator("MONGODB_URI", mode="before")
    @classmethod
    def strip_mongodb_uri(cls, v: str) -> str:
        return str(v).strip().strip('"').strip("'").strip()

    @field_validator("TWILIO_AUTH_TOKEN", "TWILIO_ACCOUNT_SID", mode="before")
    @classmethod
    def strip_twilio(cls, v: str) -> str:
        return str(v).strip().strip('"').strip("'").strip()

    # ── Convenience helpers ──────────────────────────────────────────────────

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Cached singleton. Call get_settings.cache_clear() in tests.
    Prints the resolved .env path at first load so startup logs confirm
    which file was actually read.
    """
    print(f"📂 [CONFIG] Loading .env from: {_ENV_FILE}")
    print(f"📂 [CONFIG] .env exists on disk: {_ENV_FILE.exists()}")

    settings = Settings()

    # ── Startup diagnostic — visible in uvicorn logs ─────────────────────────
    key = settings.GEMINI_API_KEY
    print(f"🔑 [CONFIG] GEMINI_API_KEY length : {len(key)}")
    print(f"🔑 [CONFIG] GEMINI_API_KEY preview: {key[:8]}…{key[-4:] if len(key) >= 8 else '???'}")
    print(f"🗄️  [CONFIG] MONGODB_URI   preview : {settings.MONGODB_URI[:40]}…")
    print(f"🌍 [CONFIG] APP_ENV                : {settings.APP_ENV}")

    return settings