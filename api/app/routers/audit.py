"""Audit router — filterable audit log."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.models.project import Project
from app.schemas.dashboard import AuditEntryResponse, AuditCreate
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/", response_model=list[AuditEntryResponse])
async def list_audit(
    action: str | None = Query(None),
    success: bool | None = Query(None),
    project_id: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Listar audit log con filtros opcionales."""
    # Single JOIN query instead of N+1 (was: 1 query per entry to get project name)
    query = (
        select(AuditLog, Project.name.label("project_name"))
        .outerjoin(Project, AuditLog.project_id == Project.id)
    )

    if action:
        query = query.where(AuditLog.action == action)
    if success is not None:
        query = query.where(AuditLog.success == success)
    if project_id:
        query = query.where(AuditLog.project_id == project_id)

    query = query.order_by(desc(AuditLog.created_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    return [
        AuditEntryResponse(
            id=e.id,
            action=e.action,
            project_name=project_name or "",
            environment=e.environment,
            skill_name=None,
            message=e.message,
            success=e.success,
            duration_ms=e.duration_ms,
            created_at=e.created_at.isoformat() if e.created_at else "",
        )
        for e, project_name in rows
    ]


@router.post("/", response_model=AuditEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_audit(
    body: AuditCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Crear un log de auditoría (normalmente usado por el CLI vía X-API-Key)."""
    try:
        from app.services.project_service import get_user_org_id
        org_id = await get_user_org_id(db, user.id)

        project_id = None
        if body.project_name and org_id:
            from sqlalchemy import or_
            proj_q = await db.execute(
                select(Project.id).where(
                    or_(Project.slug == body.project_name, Project.name == body.project_name),
                    Project.org_id == org_id
                ).limit(1)
            )
            project_id = proj_q.scalar_one_or_none()

        from app.models.audit import AuditAction
        import enum

        safe_action = body.action
        try:
            safe_action = AuditAction(body.action)
        except Exception:
            pass # Fallback to string if enum lookup fails

        entry = AuditLog(
            user_id=user.id,
            org_id=org_id,
            project_id=project_id,
            action=safe_action,
            environment=body.environment,
            message=body.message,
            success=body.success,
            duration_ms=body.duration_ms,
        )
        db.add(entry)
        await db.commit()
        await db.refresh(entry)

        return AuditEntryResponse(
            id=entry.id,
            action=entry.action,
            project_name=body.project_name,
            environment=entry.environment,
            skill_name=None,
            message=entry.message,
            success=entry.success,
            duration_ms=entry.duration_ms,
            created_at=entry.created_at.isoformat() if entry.created_at else "",
        )
    except Exception as e:
        from fastapi import HTTPException
        import traceback
        raise HTTPException(status_code=500, detail=f"Error inserting audit: {str(e)}\n{traceback.format_exc()}")
