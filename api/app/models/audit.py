"""Audit Log model — immutable, append-only."""

import uuid
import enum
from datetime import datetime

from sqlalchemy import String, DateTime, Integer, Boolean, ForeignKey, JSON, Enum as SAEnum, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditAction(str, enum.Enum):
    context_switch = "context_switch"
    env_inject = "env_inject"
    git_switch = "git_switch"
    cli_switch = "cli_switch"
    project_init = "project_init"
    project_create = "project_create"
    project_delete = "project_delete"
    skill_enable = "skill_enable"
    skill_disable = "skill_disable"
    profile_update = "profile_update"
    member_invite = "member_invite"
    member_remove = "member_remove"
    error = "error"


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        # Composite indexes for common query patterns
        Index("ix_audit_action_created", "action", "created_at"),      # stats: switches per day, skills executed
        Index("ix_audit_project_action", "project_id", "action"),      # switch count & last switch per project
        Index("ix_audit_action_success", "action", "success"),         # tools connected query
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    org_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("organizations.id"))
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    project_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("projects.id"))
    skill_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("skill_definitions.id"))
    action: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    environment: Mapped[str | None] = mapped_column(String(50))
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    details: Mapped[dict | None] = mapped_column(JSON, default=dict)
    success: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    user_agent: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)

