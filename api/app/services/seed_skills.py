"""Seed default skill definitions into the database."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.skill import SkillDefinition, SkillCategory


DEFAULT_SKILLS = [
    # ─── Free Skills (is_premium=False) ───
    {
        "name": "Git Context",
        "description": "Detecta la rama actual, último commit y estado del working tree al cambiar de contexto.",
        "category": SkillCategory.git_state,
        "is_premium": False,
        "icon": "🔀",
        "version": "1.0.0",
    },
    {
        "name": "Env Injector",
        "description": "Inyecta variables de entorno del perfil seleccionado automáticamente en tu terminal.",
        "category": SkillCategory.context_injection,
        "is_premium": False,
        "icon": "💉",
        "version": "1.0.0",
    },
    {
        "name": "Branch Switcher",
        "description": "Cambia automáticamente a la rama Git configurada para cada entorno.",
        "category": SkillCategory.git_state,
        "is_premium": False,
        "icon": "🌿",
        "version": "1.0.0",
    },
    {
        "name": "CLI Profiler",
        "description": "Configura herramientas CLI (AWS, Stripe, Supabase, etc.) según el perfil activo.",
        "category": SkillCategory.cli_switching,
        "is_premium": False,
        "icon": "⚡",
        "version": "1.0.0",
    },
    {
        "name": "Context Snapshot",
        "description": "Guarda una snapshot del estado actual antes de cambiar de proyecto.",
        "category": SkillCategory.context_injection,
        "is_premium": False,
        "icon": "📸",
        "version": "1.0.0",
    },

    # ─── Premium Skills (is_premium=True) ───
    {
        "name": "Script Runner",
        "description": "Ejecuta scripts pre/post switch: migrations, builds, seeds, health checks y cualquier comando shell automatizado.",
        "category": SkillCategory.scripts,
        "is_premium": True,
        "icon": "🚀",
        "version": "1.0.0",
        "schema_": {
            "type": "object",
            "properties": {
                "commands": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Lista de comandos shell a ejecutar en orden",
                },
                "timeout": {
                    "type": "integer",
                    "default": 120,
                    "description": "Timeout en segundos por comando",
                },
            },
        },
    },
    {
        "name": "Auto Documentation",
        "description": "Genera un archivo NEXUS_CONTEXT.md con resumen automático del proyecto: variables, CLI tools, rama activa y skills configurados.",
        "category": SkillCategory.documentation,
        "is_premium": True,
        "icon": "📝",
        "version": "1.0.0",
        "schema_": {
            "type": "object",
            "properties": {
                "output_file": {
                    "type": "string",
                    "default": "NEXUS_CONTEXT.md",
                    "description": "Nombre del archivo de documentación generado",
                },
                "include_env_names": {
                    "type": "boolean",
                    "default": True,
                    "description": "Incluir nombres de variables de entorno (sin valores)",
                },
            },
        },
    },
    {
        "name": "Parallel Switch",
        "description": "Ejecuta todas las skills en paralelo con goroutines concurrentes para switches ultra-rápidos en monorepos.",
        "category": SkillCategory.parallel,
        "is_premium": True,
        "icon": "⚡",
        "version": "1.0.0",
        "schema_": {
            "type": "object",
            "properties": {
                "max_concurrency": {
                    "type": "integer",
                    "default": 5,
                    "description": "Número máximo de skills ejecutándose en paralelo",
                },
                "timeout": {
                    "type": "integer",
                    "default": 60,
                    "description": "Timeout global en segundos",
                },
            },
        },
    },
    {
        "name": "Cloud Audit Sync",
        "description": "Sincroniza el audit log local con la nube automáticamente en cada switch para compliance y trazabilidad.",
        "category": SkillCategory.context_injection,
        "is_premium": True,
        "icon": "☁️",
        "version": "1.0.0",
        "schema_": {
            "type": "object",
            "properties": {
                "sync_on_switch": {
                    "type": "boolean",
                    "default": True,
                    "description": "Sincronizar automáticamente al hacer switch",
                },
            },
        },
    },
    {
        "name": "Sandbox Environments",
        "description": "Crea entornos efímeros aislados para pruebas sin afectar configuraciones existentes.",
        "category": SkillCategory.sandbox,
        "is_premium": True,
        "icon": "🧪",
        "version": "1.0.0",
        "schema_": {
            "type": "object",
            "properties": {
                "auto_cleanup": {
                    "type": "boolean",
                    "default": True,
                    "description": "Limpiar entornos sandbox al salir",
                },
                "ttl_minutes": {
                    "type": "integer",
                    "default": 60,
                    "description": "Tiempo de vida del sandbox en minutos",
                },
            },
        },
    },
    {
        "name": "Team Context Sync",
        "description": "Sincroniza configuraciones de contexto entre miembros del equipo en tiempo real.",
        "category": SkillCategory.context_injection,
        "is_premium": True,
        "icon": "👥",
        "version": "1.0.0",
        "schema_": {
            "type": "object",
            "properties": {
                "broadcast_on_switch": {
                    "type": "boolean",
                    "default": True,
                    "description": "Notificar al equipo cuando cambias de contexto",
                },
            },
        },
    },
    {
        "name": "Secret Rotation",
        "description": "Rota automáticamente secrets y API keys con integración a vaults (AWS SSM, HashiCorp Vault, etc.).",
        "category": SkillCategory.cli_switching,
        "is_premium": True,
        "icon": "🔐",
        "version": "1.0.0",
        "schema_": {
            "type": "object",
            "properties": {
                "vault_provider": {
                    "type": "string",
                    "enum": ["aws_ssm", "hashicorp_vault", "gcp_secret_manager"],
                    "description": "Proveedor de vault para rotación de secrets",
                },
                "rotation_interval_days": {
                    "type": "integer",
                    "default": 90,
                    "description": "Intervalo de rotación en días",
                },
            },
        },
    },
]


async def seed_skills(db: AsyncSession) -> int:
    """Seed default skills if the table is empty. Returns count of created skills."""
    result = await db.execute(select(SkillDefinition).limit(1))
    if result.scalar_one_or_none():
        return 0  # Already seeded

    count = 0
    for skill_data in DEFAULT_SKILLS:
        skill = SkillDefinition(**skill_data)
        db.add(skill)
        count += 1

    await db.commit()
    print(f"🌱 Seeded {count} skills into the database")
    return count
