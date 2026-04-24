"""Seed script — populate database with demo data matching the dashboard mock."""

import asyncio
from datetime import datetime, timedelta

from app.database import engine, async_session, Base
from app.models.user import User
from app.models.organization import Organization, OrganizationMember, OrgRole
from app.models.project import Project
from app.models.skill import SkillDefinition, SkillConfiguration, SkillCategory
from app.models.environment import EnvironmentProfile
from app.models.audit import AuditLog
from app.services.auth_service import hash_password


async def seed():
    """Seed the database with demo data."""
    from app.config import settings
    from sqlalchemy import text

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if settings.is_postgres:
            # PostgreSQL: truncate all tables with CASCADE
            table_names = ", ".join(t.name for t in Base.metadata.sorted_tables)
            await conn.execute(text(f"TRUNCATE TABLE {table_names} CASCADE"))
        else:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # ─── User ───
        user = User(
            id="user-1",
            email="dev@acme-corp.com",
            hashed_password=hash_password("password123"),
            display_name="Carlos Dev",
            plan="free",
        )
        db.add(user)
        await db.flush()

        # ─── Organization ───
        org = Organization(
            id="org-1", name="Carlos Dev's Workspace",
            slug="carlos-dev", owner_id="user-1",
        )
        db.add(org)
        db.add(OrganizationMember(org_id="org-1", user_id="user-1", role=OrgRole.owner))
        await db.flush()

        # ─── Skills ───
        skills = [
            SkillDefinition(id="sk-1", name="Context Injection", description="Inyecta variables de entorno encriptadas en la sesión activa", category=SkillCategory.context_injection, icon="💉", is_premium=False),
            SkillDefinition(id="sk-2", name="Git State", description="Asegura que el repositorio esté en la rama correcta", category=SkillCategory.git_state, icon="🔀", is_premium=False),
            SkillDefinition(id="sk-3", name="CLI Switching", description="Cambia perfiles de autenticación en herramientas CLI", category=SkillCategory.cli_switching, icon="🔑", is_premium=False),
            SkillDefinition(id="sk-4", name="Documentation", description="Auto-genera documentación técnica desde metadatos", category=SkillCategory.documentation, icon="📚", is_premium=True),
            SkillDefinition(id="sk-5", name="Sandboxes", description="Crea entornos efímeros aislados con un clic", category=SkillCategory.sandbox, icon="🏖️", is_premium=True),
        ]
        db.add_all(skills)
        await db.flush()

        # ─── Projects ───
        projects = [
            Project(id="proj-1", org_id="org-1", name="SaaS Platform", slug="saas-platform", description="Plataforma SaaS principal con dashboard de clientes y facturación", repo_url="https://github.com/acme-corp/saas-platform"),
            Project(id="proj-2", org_id="org-1", name="Mobile API", slug="mobile-api", description="Backend API para las aplicaciones móviles iOS y Android", repo_url="https://github.com/acme-corp/mobile-api"),
            Project(id="proj-3", org_id="org-1", name="Landing Page", slug="landing-page", description="Sitio web marketing con Astro y contenido dinámico", repo_url="https://github.com/acme-corp/landing"),
        ]
        db.add_all(projects)
        await db.flush()

        # ─── Skill Configs (for each project) ───
        for proj in projects:
            for i, sk in enumerate(skills[:3]):  # Free skills only
                db.add(SkillConfiguration(project_id=proj.id, skill_id=sk.id, is_enabled=True, priority=i + 1))

        # ─── Environments ───
        envs = [
            # SaaS Platform
            EnvironmentProfile(project_id="proj-1", name="development", environment="development", git_branch="develop",
                env_vars={"NODE_ENV": "development", "DATABASE_URL": "postgresql://localhost:5432/saas_dev"},
                cli_profiles=[
                    {"tool": "gh", "account": "dev-personal", "status": "connected"},
                    {"tool": "aws", "account": "acme-dev", "region": "us-east-1", "status": "connected"},
                    {"tool": "supabase", "account": "saas-dev-ref", "org": "acme", "status": "connected"},
                    {"tool": "vercel", "account": "saas-dev", "org": "acme-dev", "status": "connected"},
                    {"tool": "mongosh", "account": "local-dev", "status": "connected"},
                ]),
            EnvironmentProfile(project_id="proj-1", name="staging", environment="staging", git_branch="staging",
                env_vars={"NODE_ENV": "staging"},
                cli_profiles=[
                    {"tool": "gh", "account": "acme-bot", "status": "connected"},
                    {"tool": "aws", "account": "acme-staging", "region": "us-east-1", "status": "connected"},
                    {"tool": "supabase", "account": "saas-stg-ref", "org": "acme", "status": "expired"},
                    {"tool": "vercel", "account": "saas-staging", "org": "acme-corp", "status": "connected"},
                ]),
            EnvironmentProfile(project_id="proj-1", name="production", environment="production", git_branch="main",
                env_vars={"NODE_ENV": "production"},
                cli_profiles=[
                    {"tool": "gh", "account": "acme-bot", "status": "connected"},
                    {"tool": "aws", "account": "acme-prod", "region": "us-east-1", "status": "connected"},
                    {"tool": "supabase", "account": "saas-prod-ref", "org": "acme", "status": "connected"},
                    {"tool": "vercel", "account": "saas-prod", "org": "acme-corp", "status": "connected"},
                    {"tool": "mongosh", "account": "prod-atlas", "status": "connected"},
                ]),
            # Mobile API
            EnvironmentProfile(project_id="proj-2", name="development", environment="development", git_branch="develop",
                env_vars={"NODE_ENV": "development"},
                cli_profiles=[
                    {"tool": "gh", "account": "dev-personal", "status": "connected"},
                    {"tool": "aws", "account": "mobile-dev", "region": "us-west-2", "status": "connected"},
                    {"tool": "supabase", "account": "mobile-dev-ref", "status": "connected"},
                ]),
            EnvironmentProfile(project_id="proj-2", name="production", environment="production", git_branch="main",
                env_vars={"NODE_ENV": "production"},
                cli_profiles=[
                    {"tool": "gh", "account": "acme-bot", "status": "connected"},
                    {"tool": "aws", "account": "mobile-prod", "region": "us-west-2", "status": "connected"},
                    {"tool": "supabase", "account": "mobile-prod-ref", "status": "connected"},
                ]),
            # Landing Page
            EnvironmentProfile(project_id="proj-3", name="development", environment="development", git_branch="develop",
                env_vars={"NODE_ENV": "development"},
                cli_profiles=[
                    {"tool": "gh", "account": "dev-personal", "status": "connected"},
                    {"tool": "vercel", "account": "landing-dev", "org": "acme-marketing", "status": "disconnected"},
                ]),
            EnvironmentProfile(project_id="proj-3", name="production", environment="production", git_branch="main",
                env_vars={"NODE_ENV": "production"},
                cli_profiles=[
                    {"tool": "gh", "account": "acme-bot", "status": "connected"},
                    {"tool": "vercel", "account": "landing-prod", "org": "acme-marketing", "status": "connected"},
                ]),
        ]
        db.add_all(envs)

        # ─── Audit Logs ───
        now = datetime.utcnow()
        audit_entries = [
            AuditLog(org_id="org-1", project_id="proj-1", user_id="user-1", action="context_switch", environment="development", message="Context switch completado exitosamente", success=True, duration_ms=1240, created_at=now - timedelta(hours=2)),
            AuditLog(org_id="org-1", project_id="proj-1", user_id="user-1", action="env_inject", environment="development", message="12 variables inyectadas", success=True, duration_ms=45, created_at=now - timedelta(hours=2)),
            AuditLog(org_id="org-1", project_id="proj-1", user_id="user-1", action="git_switch", environment="development", message="Rama cambiada: main a develop", success=True, duration_ms=320, created_at=now - timedelta(hours=2)),
            AuditLog(org_id="org-1", project_id="proj-1", user_id="user-1", action="cli_switch", environment="development", message="GitHub: acme-bot a dev-personal", success=True, duration_ms=580, created_at=now - timedelta(hours=2)),
            AuditLog(org_id="org-1", project_id="proj-1", user_id="user-1", action="cli_switch", environment="development", message="AWS: acme-prod a acme-dev", success=True, duration_ms=890, created_at=now - timedelta(hours=2)),
            AuditLog(org_id="org-1", project_id="proj-2", user_id="user-1", action="context_switch", environment="development", message="Context switch completado exitosamente", success=True, duration_ms=980, created_at=now - timedelta(hours=6)),
            AuditLog(org_id="org-1", project_id="proj-1", user_id="user-1", action="cli_switch", environment="staging", message="Supabase link fallo: token expirado", success=False, duration_ms=2100, created_at=now - timedelta(hours=9)),
            AuditLog(org_id="org-1", project_id="proj-3", user_id="user-1", action="context_switch", environment="production", message="Context switch completado con warnings", success=True, duration_ms=1560, created_at=now - timedelta(hours=12)),
            AuditLog(org_id="org-1", project_id="proj-3", user_id="user-1", action="context_switch", environment="development", message="Context switch completado exitosamente", success=True, duration_ms=780, created_at=now - timedelta(days=2)),
            AuditLog(org_id="org-1", project_id="proj-2", user_id="user-1", action="error", environment="production", message="AWS SSO login timeout", success=False, duration_ms=30000, created_at=now - timedelta(days=2)),
        ]
        db.add_all(audit_entries)

        await db.commit()
        print("Seed completado: 1 user, 1 org, 3 projects, 5 skills, 7 environments, 10 audit entries")
        print("Login: dev@acme-corp.com / password123")


if __name__ == "__main__":
    asyncio.run(seed())
