"""Antigravity API — Configuration via Pydantic BaseSettings."""

import json
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Optional


class Settings(BaseSettings):
    # App
    app_name: str = "Antigravity API"
    app_version: str = "0.1.0"
    debug: bool = True

    # Database — supports both SQLite (local) and PostgreSQL (Supabase)
    database_url: str = "sqlite+aiosqlite:///./antigravity.db"

    # Supabase (optional — for production)
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    supabase_service_role_key: Optional[str] = None

    # JWT
    secret_key: str = "dev-secret-key-change-in-production"
    access_token_expire_minutes: int = 1440  # 24 hours
    algorithm: str = "HS256"

    # CORS
    cors_origins: List[str] = ["http://localhost:3000"]

    # Freemium
    free_max_projects: int = 3
    premium_max_projects: int = 100

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            v = v.strip()
            # Try JSON first: ["url1","url2"]
            if v.startswith("["):
                try:
                    return json.loads(v)
                except json.JSONDecodeError:
                    pass
            # Comma-separated: url1,url2
            return [u.strip().strip('"').strip("'") for u in v.split(",") if u.strip()]
        return v

    @property
    def is_postgres(self) -> bool:
        """Check if we're using PostgreSQL (Supabase) vs SQLite."""
        return "postgresql" in self.database_url

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
