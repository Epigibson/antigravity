"""Auth middleware — JWT + API Key dependency for FastAPI."""

import hashlib

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.api_key import ApiKey
from app.services.auth_service import get_user_by_id, register_user
from app.services.cognito_service import verify_cognito_token
import secrets

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency — supports both JWT Bearer token and X-API-Key header."""

    # ── Try X-API-Key header first (CLI auth) ──
    api_key = request.headers.get("X-API-Key")
    if api_key:
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        try:
            result = await db.execute(
                select(ApiKey).where(ApiKey.key_hash == key_hash, ApiKey.is_active.is_(True))
            )
            api_key_record = result.scalar_one_or_none()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error validating API key",
            )

        if not api_key_record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API key inválida o desactivada",
            )

        user = await get_user_by_id(db, api_key_record.user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
        return user

    # ── Try JWT Bearer token (Dashboard auth) ──
    if credentials:
        payload = await verify_cognito_token(credentials.credentials)
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token corrupto")

        user = await get_user_by_id(db, user_id)
        if not user:
            # Auto-register user from Cognito token if they don't exist
            email = payload.get("email")
            if not email:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cognito token missing email")
            
            # Generate a random password since Cognito handles the real one
            dummy_password = secrets.token_urlsafe(32)
            display_name = payload.get("name") or payload.get("preferred_username") or email.split("@")[0]
            
            try:
                # We need to explicitly set their ID to match Cognito sub so future lookups work
                user = await register_user(db, email, dummy_password, display_name, user_id=user_id)
                await db.commit()
            except Exception as e:
                await db.rollback()
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to sync user: {str(e)}")
                
        return user

    # ── No auth provided ──
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Autenticación requerida — usa Bearer token o X-API-Key",
        headers={"WWW-Authenticate": "Bearer"},
    )
