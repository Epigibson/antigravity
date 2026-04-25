"""Skill models — catalog and per-project config."""

import uuid
import enum
from datetime import datetime

from sqlalchemy import String, DateTime, Integer, Boolean, ForeignKey, JSON, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SkillCategory(str, enum.Enum):
    context_injection = "context-injection"
    git_state = "git-state"
    cli_switching = "cli-switching"
    documentation = "documentation"
    sandbox = "sandbox"
    scripts = "scripts"
    parallel = "parallel"


class SkillDefinition(Base):
    __tablename__ = "skill_definitions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    version: Mapped[str] = mapped_column(String(20), default="1.0.0")
    category: Mapped[str] = mapped_column(
        SAEnum(SkillCategory, native_enum=False, length=30), nullable=False
    )
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    schema_: Mapped[dict | None] = mapped_column("schema", JSON, default=dict)
    icon: Mapped[str | None] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SkillConfiguration(Base):
    __tablename__ = "skill_configurations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    skill_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("skill_definitions.id", ondelete="CASCADE"), nullable=False
    )
    config: Mapped[dict | None] = mapped_column(JSON, default=dict)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    project = relationship("Project", back_populates="skill_configs")
    skill = relationship("SkillDefinition", lazy="selectin")
