"""Nexus Control Center — Backend API.

FastAPI application with JWT auth, SQLite/PostgreSQL, and RESTful endpoints.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import auth, projects, skills, audit, dashboard, billing, teams
from app.limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle — creates tables on boot (dev only)."""
    if settings.is_production:
        # Production (Lambda): skip table creation, migrations, and seeds
        # Tables already exist in Supabase — this saves ~1-3s per cold start
        print(f"🚀 {settings.app_name} v{settings.app_version} — Production mode (skipping init_db)")
    else:
        # Development: create tables, run migrations, seed data
        await init_db()
        print(f"🚀 {settings.app_name} v{settings.app_version} — Database ready")
        print(f"🌐 CORS origins: {settings.cors_origins}")
        if settings.stripe_secret_key:
            print(f"💳 Stripe configured (test mode)")

        # Seed default data & admin account
        from app.database import async_session
        from app.services.seed_skills import seed_skills
        from app.services.admin_bootstrap import bootstrap_admin
        async with async_session() as db:
            await seed_skills(db)
            await bootstrap_admin(db)

    yield
    print("👋 Shutting down...")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Centro de Control de Entornos de Desarrollo — API Backend",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─── Security Headers Middleware ───
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# ─── CORS ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ───
API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(projects.router, prefix=API_PREFIX)
app.include_router(skills.router, prefix=API_PREFIX)
app.include_router(audit.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(billing.router, prefix=API_PREFIX)
app.include_router(teams.router, prefix=API_PREFIX)


@app.get("/", tags=["Health"])
async def health():
    return {
        "status": "ok",
        "name": settings.app_name,
        "version": settings.app_version,
    }


@app.get("/api/v1/health", tags=["Health"])
async def api_health():
    return {"status": "ok", "api": "v1"}

# ─── AWS Lambda Handler ───
from mangum import Mangum
handler = Mangum(app, lifespan="on")
