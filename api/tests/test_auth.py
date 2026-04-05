"""Auth endpoint tests — registration, login, profile, API keys."""

import pytest


@pytest.mark.asyncio
async def test_register_new_user(client):
    """POST /auth/register should create user + org."""
    r = await client.post("/api/v1/auth/register", json={
        "email": "new@test.com",
        "password": "secure123",
        "display_name": "New User",
    })
    assert r.status_code == 201
    data = r.json()
    assert "access_token" in data
    assert data["email"] == "new@test.com"


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    """Registering the same email twice should fail."""
    payload = {"email": "dup@test.com", "password": "secure123"}
    r1 = await client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201
    r2 = await client.post("/api/v1/auth/register", json=payload)
    assert r2.status_code in (400, 409)  # Conflict or Bad Request
    assert "already" in r2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_success(client):
    """POST /auth/login with correct credentials."""
    await client.post("/api/v1/auth/register", json={
        "email": "login@test.com", "password": "pass1234",
    })
    r = await client.post("/api/v1/auth/login", json={
        "email": "login@test.com", "password": "pass1234",
    })
    assert r.status_code == 200
    assert "access_token" in r.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    """POST /auth/login with wrong password returns 401."""
    await client.post("/api/v1/auth/register", json={
        "email": "wrong@test.com", "password": "correct",
    })
    r = await client.post("/api/v1/auth/login", json={
        "email": "wrong@test.com", "password": "incorrect",
    })
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    """GET /auth/me without token returns 401."""
    r = await client.get("/api/v1/auth/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_with_token(client, auth_headers):
    """GET /auth/me with valid token returns profile."""
    r = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "test@test.com"
    assert data["plan"] == "free"
