"""Antigravity Control Center — Backend API.

FastAPI application with JWT auth, SQLite/PostgreSQL, and RESTful endpoints.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import auth, projects, skills, audit, dashboard


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle — creates tables on boot."""
    await init_db()
    print(f"🚀 {settings.app_name} v{settings.app_version} — Database ready")
    print(f"🌐 CORS origins: {settings.cors_origins}")
    yield
    print("👋 Shutting down...")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Centro de Control de Entornos de Desarrollo — API Backend",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

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
