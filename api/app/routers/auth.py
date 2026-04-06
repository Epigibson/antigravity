"""Auth router — register, login, profile, API keys."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.api_key import ApiKey
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse, UserUpdate
from app.services.auth_service import register_user, authenticate_user, create_access_token
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])


# ─── Pydantic models for API keys ───

class ApiKeyCreateRequest(BaseModel):
    name: str = "CLI Key"

class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    is_active: bool
    last_used_at: str | None
    created_at: str

class ApiKeyCreatedResponse(ApiKeyResponse):
    full_key: str  # Only returned on creation


# ─── Auth endpoints ───

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Crear nueva cuenta."""
    try:
        user = await register_user(db, body.email, body.password, body.display_name)
        await db.commit()
        token = create_access_token(user.id, user.email)
        return TokenResponse(
            access_token=token,
            user_id=user.id,
            email=user.email,
            display_name=user.display_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Iniciar sesión."""
    user = await authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    token = create_access_token(user.id, user.email)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )


@router.get("/me", response_model=UserResponse)
async def get_profile(user: User = Depends(get_current_user)):
    """Obtener perfil del usuario autenticado."""
    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        plan=user.plan,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


@router.put("/me", response_model=UserResponse)
async def update_profile(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Actualizar perfil."""
    if body.display_name is not None:
        user.display_name = body.display_name
    if body.avatar_url is not None:
        user.avatar_url = body.avatar_url
    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        plan=user.plan,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


# ─── API Key endpoints ───

@router.post("/api-keys", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def generate_api_key(
    body: ApiKeyCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generar nueva API key para el CLI. La key completa solo se muestra UNA vez."""
    try:
        full_key, prefix, key_hash = ApiKey.generate_key()

        api_key = ApiKey(
            name=body.name,
            key_prefix=prefix,
            key_hash=key_hash,
            user_id=user.id,
        )
        db.add(api_key)
        await db.commit()
        await db.refresh(api_key)

        return ApiKeyCreatedResponse(
            id=api_key.id,
            name=api_key.name,
            key_prefix=api_key.key_prefix,
            full_key=full_key,
            is_active=api_key.is_active,
            last_used_at=None,
            created_at=api_key.created_at.isoformat() if api_key.created_at else "",
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating API key: {str(e)}")


@router.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Listar API keys (sin mostrar la key completa, solo el prefijo)."""
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id, ApiKey.is_active == True)
    )
    keys = result.scalars().all()
    return [
        ApiKeyResponse(
            id=k.id,
            name=k.name,
            key_prefix=k.key_prefix,
            is_active=k.is_active,
            last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
            created_at=k.created_at.isoformat() if k.created_at else "",
        )
        for k in keys
    ]


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revocar una API key (soft delete)."""
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user.id)
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key no encontrada")

    api_key.is_active = False
    await db.commit()

