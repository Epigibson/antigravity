"""Nexus API — Database engine and session factory (SQLAlchemy 2.0 async).

Supports both SQLite (local development) and PostgreSQL (Supabase production).
Switch by changing DATABASE_URL in .env.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import settings

# ─── Engine configuration ───
engine_kwargs = {
    "echo": settings.debug,
}

if settings.is_postgres:
    # PostgreSQL (Supabase) — use NullPool for serverless-friendly connections
    engine_kwargs["poolclass"] = NullPool
    # SSL required for Supabase
    engine_kwargs["connect_args"] = {"ssl": "prefer"}
else:
    # SQLite — needs check_same_thread=False for async
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_async_engine(settings.database_url, **engine_kwargs)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Alias for middleware that needs its own session (not from FastAPI dependency)
AsyncSessionLocal = async_session


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


async def get_db():
    """FastAPI dependency — yields an async database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """Create all tables (dev only — use migrations in production)."""
    # Import all models so they register with Base.metadata
    import app.models.user  # noqa: F401
    import app.models.organization  # noqa: F401
    import app.models.project  # noqa: F401
    import app.models.skill  # noqa: F401
    import app.models.environment  # noqa: F401
    import app.models.audit  # noqa: F401
    import app.models.subscription  # noqa: F401
    import app.models.api_key  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Auto-migrate: add missing columns to existing tables
    await _auto_migrate()


async def _auto_migrate():
    """Safely add missing columns to existing tables (idempotent)."""
    migrations = [
        # (table, column, sql_type, default)
        ("environment_profiles", "hooks", "JSON", "'[]'"),
    ]

    async with engine.begin() as conn:
        for table, column, sql_type, default in migrations:
            try:
                await conn.execute(
                    text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {sql_type} DEFAULT {default}")
                )
                print(f"  ✅ Migration: {table}.{column} ensured")
            except Exception as e:
                # Column might already exist or DB doesn't support IF NOT EXISTS
                print(f"  ⚠️ Migration {table}.{column}: {e}")
