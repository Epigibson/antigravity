"""Environment Profile model — per-project, per-environment CLI configs."""

import uuid
import enum
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, JSON, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EnvironmentType(str, enum.Enum):
    development = "development"
    staging = "staging"
    production = "production"
    custom = "custom"


class EnvironmentProfile(Base):
    __tablename__ = "environment_profiles"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    environment: Mapped[str] = mapped_column(
        SAEnum(EnvironmentType, native_enum=False, length=20), default=EnvironmentType.development
    )
    git_branch: Mapped[str | None] = mapped_column(String(100))
    env_vars: Mapped[dict | None] = mapped_column(JSON, default=dict)
    cli_profiles: Mapped[list | None] = mapped_column(JSON, default=list)
    cloud_config: Mapped[dict | None] = mapped_column(JSON, default=dict)
    hooks: Mapped[list | None] = mapped_column(JSON, default=list)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    project = relationship("Project", back_populates="environments")
