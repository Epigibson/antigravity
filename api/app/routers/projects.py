"""Projects router — CRUD with environments."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.environment import EnvironmentProfile
from app.schemas.project import (
    ProjectResponse, ProjectCreate, ProjectUpdate,
    EnvironmentSchema, EnvironmentCreate, EnvironmentUpdate,
    CLIProfileSchema, SkillSchema, ScriptHookSchema,
)
from app.services.project_service import (
    list_projects, get_project_by_slug, create_project,
    update_project, delete_project, get_project_switch_count,
    get_project_last_switch,
)
from app.services.plan_enforcement import check_cli_tools_limit
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/projects", tags=["Projects"])


def _mask_value(v: str) -> str:
    """Mask a secret value, showing only first 4 chars."""
    if len(v) <= 4:
        return "****"
    return v[:4] + "••••"


def _env_to_schema(env: EnvironmentProfile) -> EnvironmentSchema:
    profiles = [CLIProfileSchema(**p) for p in (env.cli_profiles or [])]
    hooks = [ScriptHookSchema(**h) for h in (env.hooks or [])]
    raw_vars = env.env_vars or {}
    return EnvironmentSchema(
        id=env.id,
        name=env.name,
        environment=env.environment,
        git_branch=env.git_branch,
        env_var_count=len(raw_vars),
        env_var_keys=list(raw_vars.keys()),
        env_vars={k: _mask_value(v) for k, v in raw_vars.items()},
        cli_profiles=profiles,
        hooks=hooks,
    )


def _env_to_schema_unmasked(env: EnvironmentProfile) -> EnvironmentSchema:
    """Return env vars WITHOUT masking — used by CLI endpoint only."""
    profiles = [CLIProfileSchema(**p) for p in (env.cli_profiles or [])]
    hooks = [ScriptHookSchema(**h) for h in (env.hooks or [])]
    raw_vars = env.env_vars or {}
    return EnvironmentSchema(
        id=env.id,
        name=env.name,
        environment=env.environment,
        git_branch=env.git_branch,
        env_var_count=len(raw_vars),
        env_var_keys=list(raw_vars.keys()),
        env_vars=raw_vars,  # UNMASKED values for CLI
        cli_profiles=profiles,
        hooks=hooks,
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


async def _project_response_unmasked(db, project) -> ProjectResponse:
    """Same as _project_response but env vars are NOT masked. For CLI only."""
    switch_count = await get_project_switch_count(db, project.id)
    last_switch = await get_project_last_switch(db, project.id)

    envs = [_env_to_schema_unmasked(e) for e in project.environments]
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
    """Obtener detalle de un proyecto por slug (env vars enmascarados)."""
    project = await get_project_by_slug(db, user.id, slug)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")
    return await _project_response(db, project)


@router.get("/{slug}/cli-context", response_model=ProjectResponse)
async def get_cli_context(
    slug: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtener contexto completo para el CLI — env vars SIN enmascarar.
    Solo accesible con X-API-Key (no JWT del dashboard)."""
    # Verify this is CLI auth (X-API-Key), not dashboard JWT
    if not request.headers.get("X-API-Key"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is only accessible via CLI (X-API-Key)",
        )
    project = await get_project_by_slug(db, user.id, slug)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")
    return await _project_response_unmasked(db, project)


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

    # Enforce CLI tools limit
    new_profiles = body.cli_profiles or []
    if new_profiles:
        try:
            await check_cli_tools_limit(db, project.org_id, project.id, len(new_profiles))
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    env = EnvironmentProfile(
        project_id=project.id,
        name=body.name,
        environment=body.environment,
        git_branch=body.git_branch,
        env_vars=body.env_vars,
        cli_profiles=[p.model_dump() for p in body.cli_profiles],
        hooks=[h.model_dump() for h in body.hooks],
    )
    db.add(env)
    await db.commit()
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
        try:
            await check_cli_tools_limit(db, project.org_id, project.id, len(body.cli_profiles))
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
        env.cli_profiles = [p.model_dump() for p in body.cli_profiles]
    if body.hooks is not None:
        env.hooks = [h.model_dump() for h in body.hooks]

    await db.commit()
    return _env_to_schema(env)


@router.delete("/{slug}/environments/{env_name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_env(slug: str, env_name: str,
                     user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Eliminar un entorno."""
    project = await get_project_by_slug(db, user.id, slug)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado")

    env = next((e for e in project.environments if e.name == env_name), None)
    if not env:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entorno no encontrado")

    await db.delete(env)
    await db.commit()
