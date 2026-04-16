"""Teams router — organization member management."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.organization import Organization, OrganizationMember, OrgRole
from app.middleware.auth import get_current_user
from app.services.plan_enforcement import check_member_limit

router = APIRouter(prefix="/teams", tags=["Teams"])


# ─── Schemas ───

class MemberResponse(BaseModel):
    user_id: str
    email: str
    display_name: str | None
    role: str
    joined_at: str


class InviteMemberRequest(BaseModel):
    email: str
    role: str = "member"  # member | admin


class UpdateRoleRequest(BaseModel):
    role: str  # member | admin


# ─── Helpers ───

async def _get_user_org(user: User, db: AsyncSession) -> Organization:
    """Get the user's owned organization."""
    result = await db.execute(
        select(Organization).where(Organization.owner_id == user.id).limit(1)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="No tienes una organización")
    return org


async def _require_admin(user: User, org: Organization, db: AsyncSession) -> None:
    """Check that user is owner or admin of the org."""
    if org.owner_id == user.id:
        return
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org.id,
            OrganizationMember.user_id == user.id,
        )
    )
    member = result.scalar_one_or_none()
    if not member or member.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="No tienes permisos para gestionar el equipo")


# ─── Endpoints ───

@router.get("/members", response_model=list[MemberResponse])
async def list_members(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Listar miembros de la organización."""
    org = await _get_user_org(user, db)

    # Owner is always a member
    members_data = [
        MemberResponse(
            user_id=org.owner.id,
            email=org.owner.email,
            display_name=org.owner.display_name,
            role="owner",
            joined_at=org.created_at.isoformat() if org.created_at else "",
        )
    ]

    # Other members
    for m in org.members:
        if m.user_id == org.owner_id:
            continue  # Already added as owner
        # Get user info
        user_result = await db.execute(
            select(User).where(User.id == m.user_id)
        )
        member_user = user_result.scalar_one_or_none()
        if member_user:
            members_data.append(MemberResponse(
                user_id=member_user.id,
                email=member_user.email,
                display_name=member_user.display_name,
                role=m.role.value if isinstance(m.role, OrgRole) else m.role,
                joined_at=m.joined_at.isoformat() if m.joined_at else "",
            ))

    return members_data


@router.post("/members", response_model=MemberResponse, status_code=201)
async def invite_member(
    body: InviteMemberRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invitar un miembro al equipo."""
    org = await _get_user_org(user, db)
    await _require_admin(user, org, db)

    # Enforce plan limit
    try:
        await check_member_limit(db, org.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    # Find target user
    target_result = await db.execute(
        select(User).where(User.email == body.email)
    )
    target_user = target_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado. Debe registrarse primero.")

    # Check not already a member
    existing = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org.id,
            OrganizationMember.user_id == target_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="El usuario ya es miembro del equipo")

    # Add member
    role = OrgRole(body.role) if body.role in [r.value for r in OrgRole] else OrgRole.member
    member = OrganizationMember(
        org_id=org.id,
        user_id=target_user.id,
        role=role,
    )
    db.add(member)
    await db.commit()

    return MemberResponse(
        user_id=target_user.id,
        email=target_user.email,
        display_name=target_user.display_name,
        role=role.value,
        joined_at=member.joined_at.isoformat() if member.joined_at else "",
    )


@router.put("/members/{member_user_id}", response_model=MemberResponse)
async def update_member_role(
    member_user_id: str,
    body: UpdateRoleRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cambiar el rol de un miembro."""
    org = await _get_user_org(user, db)
    await _require_admin(user, org, db)

    if member_user_id == org.owner_id:
        raise HTTPException(status_code=400, detail="No puedes cambiar el rol del propietario")

    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org.id,
            OrganizationMember.user_id == member_user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")

    role = OrgRole(body.role) if body.role in [r.value for r in OrgRole] else OrgRole.member
    member.role = role
    await db.commit()

    # Get user info
    user_result = await db.execute(select(User).where(User.id == member_user_id))
    member_user = user_result.scalar_one()

    return MemberResponse(
        user_id=member_user.id,
        email=member_user.email,
        display_name=member_user.display_name,
        role=role.value,
        joined_at=member.joined_at.isoformat() if member.joined_at else "",
    )


@router.delete("/members/{member_user_id}", status_code=204)
async def remove_member(
    member_user_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Eliminar un miembro del equipo."""
    org = await _get_user_org(user, db)
    await _require_admin(user, org, db)

    if member_user_id == org.owner_id:
        raise HTTPException(status_code=400, detail="No puedes eliminar al propietario")

    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org.id,
            OrganizationMember.user_id == member_user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")

    await db.delete(member)
    await db.commit()
