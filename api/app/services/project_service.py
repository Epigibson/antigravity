"""Project service — CRUD with freemium enforcement."""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.skill import SkillConfiguration, SkillDefinition

from app.models.project import Project
from app.models.organization import Organization, OrganizationMember
from app.models.audit import AuditLog
from app.config import settings


async def get_user_org_id(db: AsyncSession, user_id: str) -> str | None:
    """Get the user's primary organization ID."""
    result = await db.execute(
        select(OrganizationMember.org_id)
        .where(OrganizationMember.user_id == user_id)
        .limit(1)
    )
    row = result.scalar_one_or_none()
    return row


async def list_projects(db: AsyncSession, user_id: str) -> list[Project]:
    """List all projects for the user's organization."""
    org_id = await get_user_org_id(db, user_id)
    if not org_id:
        return []

    result = await db.execute(
        select(Project)
        .where(Project.org_id == org_id, Project.is_active == True)
        .options(
            selectinload(Project.environments),
            selectinload(Project.skill_configs).selectinload(SkillConfiguration.skill),
        )
        .order_by(Project.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_project_by_slug(db: AsyncSession, user_id: str, slug: str) -> Project | None:
    """Get a single project by slug, ensuring ownership."""
    org_id = await get_user_org_id(db, user_id)
    if not org_id:
        return None

    result = await db.execute(
        select(Project)
        .where(Project.org_id == org_id, Project.slug == slug, Project.is_active == True)
        .options(
            selectinload(Project.environments),
            selectinload(Project.skill_configs).selectinload(SkillConfiguration.skill),
        )
    )
    return result.scalar_one_or_none()


async def create_project(db: AsyncSession, user_id: str, name: str, slug: str,
                         description: str | None = None, repo_url: str | None = None) -> Project:
    """Create a project with freemium enforcement."""
    org_id = await get_user_org_id(db, user_id)
    if not org_id:
        raise ValueError("User has no organization")

    # Freemium check
    org_result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = org_result.scalar_one()

    count_result = await db.execute(
        select(func.count(Project.id)).where(Project.org_id == org_id, Project.is_active == True)
    )
    project_count = count_result.scalar() or 0

    max_projects = settings.free_max_projects if org.plan == "free" else settings.premium_max_projects
    if project_count >= max_projects:
        raise ValueError(f"Plan '{org.plan}' limit reached: {max_projects} projects max. Upgrade to create more.")

    # Check slug uniqueness within org
    existing = await db.execute(
        select(Project).where(Project.org_id == org_id, Project.slug == slug)
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"Project slug '{slug}' already exists")

    project = Project(
        org_id=org_id, name=name, slug=slug,
        description=description, repo_url=repo_url,
    )
    db.add(project)
    return project


async def update_project(db: AsyncSession, project: Project, **kwargs) -> Project:
    for key, value in kwargs.items():
        if value is not None and hasattr(project, key):
            setattr(project, key, value)
    return project


async def delete_project(db: AsyncSession, project: Project) -> None:
    """Soft delete."""
    project.is_active = False


async def get_project_switch_count(db: AsyncSession, project_id: str) -> int:
    result = await db.execute(
        select(func.count(AuditLog.id)).where(
            AuditLog.project_id == project_id,
            AuditLog.action == "context_switch"
        )
    )
    return result.scalar() or 0


async def get_project_last_switch(db: AsyncSession, project_id: str) -> str | None:
    result = await db.execute(
        select(AuditLog.created_at).where(
            AuditLog.project_id == project_id,
            AuditLog.action == "context_switch"
        ).order_by(AuditLog.created_at.desc()).limit(1)
    )
    row = result.scalar_one_or_none()
    return row.isoformat() if row else None
