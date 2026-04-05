"""Projects router — CRUD with environments."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.environment import EnvironmentProfile
from app.schemas.project import (
    ProjectResponse, ProjectCreate, ProjectUpdate,
    EnvironmentSchema, EnvironmentCreate, EnvironmentUpdate,
    CLIProfileSchema, SkillSchema,
)
from app.services.project_service import (
    list_projects, get_project_by_slug, create_project,
    update_project, delete_project, get_project_switch_count,
    get_project_last_switch,
)
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/projects", tags=["Projects"])


def _env_to_schema(env: EnvironmentProfile) -> EnvironmentSchema:
    profiles = [CLIProfileSchema(**p) for p in (env.cli_profiles or [])]
    return EnvironmentSchema(
        id=env.id,
        name=env.name,
        environment=env.environment,
        git_branch=env.git_branch,
        env_var_count=len(env.env_vars or {}),
        cli_profiles=profiles,
    )


async def _project_response(db, project) -> ProjectResponse:
    switch_count = await get_project_switch_count(db, project.id)
    last_switch = await get_project_last_switch(db, project.id)

    envs = [_env_to_schema(e) for e in project.environments]
    skills = []
    for sc in project.skill_configs:
        s = sc.skill
        if s:
            skills.append(SkillSchema(
                id=s.id, name=s.name, description=s.description,
                category=s.category, icon=s.icon,
                is_enabled=sc.is_enabled, priority=sc.priority,
                is_premium=s.is_premium,
            ))

    return ProjectResponse(
        id=project.id, name=project.name, slug=project.slug,
        description=project.description, repo_url=project.repo_url,
        is_active=project.is_active, environments=envs, skills=skills,
        switch_count=switch_count, last_switch=last_switch,
        created_at=project.created_at.isoformat() if project.created_at else "",
    )


@router.get("/", response_model=list[ProjectResponse])
async def list_all(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Listar todos los proyectos del usuario."""
    projects = await list_projects(db, user.id)
    return [await _project_response(db, p) for p in projects]


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create(body: ProjectCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Crear un nuevo proyecto (con enforcement de freemium)."""
    try:
        project = await create_project(db, user.id, body.name, body.slug, body.description, body.repo_url)
        await db.commit()
        # Reload with relationships for response
        reloaded = await get_project_by_slug(db, user.id, body.slug)
        return await _project_response(db, reloaded)
    except ValueError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{slug}", response_model=ProjectResponse)
async def get_one(slug: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Obtener detalle de un proyecto por slug."""
    project = await get_project_by_slug(db, user.id, slug)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")
    return await _project_response(db, project)


@router.put("/{slug}", response_model=ProjectResponse)
async def update(slug: str, body: ProjectUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Actualizar un proyecto."""
    project = await get_project_by_slug(db, user.id, slug)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")
    await update_project(db, project, **body.model_dump(exclude_unset=True))
    return await _project_response(db, project)


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(slug: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Eliminar (soft delete) un proyecto."""
    project = await get_project_by_slug(db, user.id, slug)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")
    await delete_project(db, project)
    await db.commit()


# ─── Environments ───

@router.get("/{slug}/environments", response_model=list[EnvironmentSchema])
async def list_envs(slug: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Listar entornos de un proyecto."""
    project = await get_project_by_slug(db, user.id, slug)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")
    return [_env_to_schema(e) for e in project.environments]


@router.post("/{slug}/environments", response_model=EnvironmentSchema, status_code=status.HTTP_201_CREATED)
async def create_env(slug: str, body: EnvironmentCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Crear un entorno para un proyecto."""
    project = await get_project_by_slug(db, user.id, slug)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")

    env = EnvironmentProfile(
        project_id=project.id,
        name=body.name,
        environment=body.environment,
        git_branch=body.git_branch,
        env_vars=body.env_vars,
        cli_profiles=[p.model_dump() for p in body.cli_profiles],
    )
    db.add(env)
    await db.flush()
    return _env_to_schema(env)


@router.put("/{slug}/environments/{env_name}", response_model=EnvironmentSchema)
async def update_env(slug: str, env_name: str, body: EnvironmentUpdate,
                     user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Actualizar un entorno."""
    project = await get_project_by_slug(db, user.id, slug)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")

    env = next((e for e in project.environments if e.name == env_name), None)
    if not env:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entorno no encontrado")

    if body.git_branch is not None:
        env.git_branch = body.git_branch
    if body.env_vars is not None:
        env.env_vars = body.env_vars
    if body.cli_profiles is not None:
        env.cli_profiles = [p.model_dump() for p in body.cli_profiles]

    return _env_to_schema(env)
