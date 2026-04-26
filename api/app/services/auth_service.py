"""Auth service — JWT tokens + password hashing."""

from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User
from app.models.organization import Organization, OrganizationMember, OrgRole


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "type": "refresh"
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except JWTError:
        return None


async def register_user(db: AsyncSession, email: str, password: str, display_name: str | None = None, user_id: str | None = None) -> User:
    """Register a new user and create their personal org."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise ValueError("Email already registered")

    user = User(
        email=email,
        hashed_password=hash_password(password),
        display_name=display_name or email.split("@")[0],
    )
    if user_id:
        user.id = user_id
    db.add(user)
    await db.flush()

    # Create personal organization
    org = Organization(
        name=f"{user.display_name}'s Workspace",
        slug=email.split("@")[0].lower().replace(".", "-"),
        owner_id=user.id,
    )
    db.add(org)
    await db.flush()

    # Add as owner member
    member = OrganizationMember(org_id=org.id, user_id=user.id, role=OrgRole.owner)
    db.add(member)

    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
