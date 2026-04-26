"""Nexus API — Configuration via Pydantic BaseSettings."""

import json
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Optional
import os


class Settings(BaseSettings):
    # App
    app_name: str = "Nexus API"
    app_version: str = "0.1.0"
    debug: bool = True

    # Database — supports both SQLite (local) and PostgreSQL (Supabase)
    database_url: str = "sqlite+aiosqlite:///./nexus.db"

    @field_validator("database_url", mode="before")
    @classmethod
    def format_database_url(cls, v):
        if v and (v.startswith("postgres://") or v.startswith("postgresql://")):
            # SQLAlchemy async requires postgresql+asyncpg://
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # Supabase (optional — for production)
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    supabase_service_role_key: Optional[str] = None

    # JWT & Crypto
    secret_key: str = "dev-secret-key-change-in-production"
    encryption_key: str = "gZz3p44P624ZzYGBa8qL4Vqof9w4d7S0AILv6Ew8zZ0=" # 32-byte base64 default
    access_token_expire_minutes: int = 15  # 15 minutes (was 24 hours)
    algorithm: str = "HS256"

    # AWS Cognito
    cognito_region: str = "us-east-1"
    cognito_user_pool_id: Optional[str] = None
    cognito_client_id: Optional[str] = None

    # CORS
    cors_origins: List[str] = ["http://localhost:3000"]

    # Freemium limits
    free_max_projects: int = 3
    free_max_cli_tools: int = 5
    free_max_members: int = 1
    premium_max_projects: int = 100
    premium_max_cli_tools: int = 999  # virtually unlimited
    premium_max_members: int = 50

    # Stripe
    stripe_secret_key: Optional[str] = None
    stripe_publishable_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    stripe_premium_price_id: Optional[str] = None  # "auto" = create on boot

    # Environment
    environment: str = "development"

    # Frontend
    frontend_url: str = "http://localhost:3000"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, list):
            origins = v
        elif isinstance(v, str):
            v = v.strip()
            # Try JSON first: ["url1","url2"]
            if v.startswith("["):
                try:
                    origins = json.loads(v)
                except json.JSONDecodeError:
                    origins = [u.strip().strip('"').strip("'") for u in v.split(",") if u.strip()]
            else:
                # Comma-separated: url1,url2
                origins = [u.strip().strip('"').strip("'") for u in v.split(",") if u.strip()]
        else:
            origins = v if isinstance(v, list) else []

        # Always allow localhost for development
        for local in ["http://localhost:3000", "http://127.0.0.1:3000"]:
            if local not in origins:
                origins.append(local)
        return origins

    @property
    def is_postgres(self) -> bool:
        """Check if we're using PostgreSQL (Supabase) vs SQLite."""
        return "postgres" in self.database_url

    @property
    def is_production(self) -> bool:
        """Check if running in production (AWS Lambda)."""
        return self.environment.lower() == "production" or "AWS_LAMBDA_FUNCTION_NAME" in os.environ

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
