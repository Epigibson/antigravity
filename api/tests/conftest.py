"""Shared test fixtures — in-memory SQLite DB, test client, auth helpers."""

import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.database import Base, get_db
from app.main import app
from app.services.auth_service import register_user, create_access_token


# ── Engine & Session ──

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DB_URL, echo=False)
TestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ── Fixtures ──

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Create all tables before each test, drop after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db():
    """Provide a fresh DB session for service-level tests."""
    async with TestSession() as session:
        yield session


@pytest_asyncio.fixture
async def client(db):
    """Provide an async HTTP client wired to the test DB."""
    async def override_get_db():
        async with TestSession() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_user(db):
    """Register a test user, return (user, token)."""
    user = await register_user(db, "test@test.com", "password123", "Test User")
    await db.commit()
    token = create_access_token(user.id, user.email)
    return user, token


@pytest_asyncio.fixture
async def auth_headers(auth_user):
    """Return headers with Bearer token."""
    _, token = auth_user
    return {"Authorization": f"Bearer {token}"}
