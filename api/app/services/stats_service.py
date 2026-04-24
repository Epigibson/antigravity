"""Dashboard stats service — aggregation queries."""

from datetime import datetime, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.audit import AuditLog
from app.models.organization import OrganizationMember
from app.services.project_service import get_user_org_id


async def get_stats(db: AsyncSession, user_id: str) -> dict:
    org_id = await get_user_org_id(db, user_id)
    if not org_id:
        return {"total_projects": 0, "switches_today": 0, "skills_executed": 0, "tools_connected": 0}

    # Total active projects
    proj_count = await db.execute(
        select(func.count(Project.id)).where(Project.org_id == org_id, Project.is_active == True)
    )

    # Switches today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    switches_today = await db.execute(
        select(func.count(AuditLog.id)).where(
            AuditLog.action == "context_switch",
            AuditLog.created_at >= today_start,
        )
    )

    # Skills executed (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    skills_count = await db.execute(
        select(func.count(AuditLog.id)).where(
            AuditLog.action.in_(["env_inject", "git_switch", "cli_switch"]),
            AuditLog.created_at >= week_ago,
        )
    )

    # Unique tools connected (from cli_switch actions)
    tools = await db.execute(
        select(func.count(func.distinct(AuditLog.environment))).where(
            AuditLog.action == "cli_switch",
            AuditLog.success == True,
        )
    )

    return {
        "total_projects": proj_count.scalar() or 0,
        "switches_today": switches_today.scalar() or 0,
        "skills_executed": skills_count.scalar() or 0,
        "tools_connected": tools.scalar() or 0,
    }


async def get_activity(db: AsyncSession, user_id: str, days: int = 7) -> list[dict]:
    """Get switches per day for the last N days."""
    start = datetime.utcnow() - timedelta(days=days)
    result = await db.execute(
        select(
            func.date(AuditLog.created_at).label("day"),
            func.count(AuditLog.id).label("switches"),
        )
        .where(
            AuditLog.action == "context_switch",
            AuditLog.created_at >= start,
        )
        .group_by(func.date(AuditLog.created_at))
        .order_by(func.date(AuditLog.created_at))
    )
    rows = result.all()

    # Fill in missing days
    activity = []
    day_names = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    day_map = {str(r[0]): r[1] for r in rows}

    for i in range(days):
        d = (datetime.utcnow() - timedelta(days=days - 1 - i)).date()
        activity.append({
            "day": day_names[d.weekday()],
            "switches": day_map.get(str(d), 0),
        })

    return activity


async def get_recent_switches(db: AsyncSession, user_id: str, limit: int = 10) -> list[dict]:
    result = await db.execute(
        select(AuditLog, Project.name.label("proj_name"))
        .outerjoin(Project, AuditLog.project_id == Project.id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    rows = result.all()
    return [
        {
            "id": e.id,
            "project_name": proj_name or "—",
            "environment": e.environment or "",
            "message": e.message,
            "success": e.success,
            "duration_ms": e.duration_ms,
            "created_at": e.created_at.isoformat() if e.created_at else "",
        }
        for e, proj_name in rows
    ]
