"""API Key model for CLI authentication."""

import uuid
import hashlib
from datetime import datetime, timezone

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from app.database import Base


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    key_prefix = Column(String(30), nullable=False)  # "ag_live_xxxx..." visible part
    key_hash = Column(String(64), nullable=False, unique=True)  # SHA-256 of full key
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(
        DateTime, default=datetime.utcnow
    )

    @staticmethod
    def generate_key() -> tuple[str, str, str]:
        """Generate a new API key. Returns (full_key, prefix, hash)."""
        raw = uuid.uuid4().hex + uuid.uuid4().hex  # 64 hex chars
        full_key = f"ag_live_{raw}"
        prefix = f"ag_live_{raw[:8]}..."
        key_hash = hashlib.sha256(full_key.encode()).hexdigest()
        return full_key, prefix, key_hash
