"""API Key generation and authentication tests."""

import pytest


@pytest.mark.asyncio
async def test_generate_api_key(client, auth_headers):
    """POST /auth/api-keys generates a new API key."""
    r = await client.post("/api/v1/auth/api-keys", headers=auth_headers, json={
        "name": "CLI Key"
    })
    assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
    data = r.json()
    assert data["name"] == "CLI Key"
    assert data["full_key"].startswith("ag_live_")
    assert data["key_prefix"].startswith("ag_live_")
    assert data["is_active"] is True


@pytest.mark.asyncio
async def test_list_api_keys(client, auth_headers):
    """GET /auth/api-keys lists user's keys."""
    # Generate one first
    await client.post("/api/v1/auth/api-keys", headers=auth_headers, json={"name": "Test"})

    r = await client.get("/api/v1/auth/api-keys", headers=auth_headers)
    assert r.status_code == 200
    keys = r.json()
    assert len(keys) >= 1
    assert keys[0]["name"] == "Test"
    # full_key should NOT be in list response
    assert "full_key" not in keys[0]


@pytest.mark.asyncio
async def test_auth_with_api_key(client, auth_headers):
    """X-API-Key header should authenticate the user."""
    # Generate a key
    r = await client.post("/api/v1/auth/api-keys", headers=auth_headers, json={"name": "Auth Test"})
    full_key = r.json()["full_key"]

    # Use it to access a protected endpoint
    r2 = await client.get("/api/v1/auth/me", headers={"X-API-Key": full_key})
    assert r2.status_code == 200, f"API key auth failed: {r2.text}"
    assert r2.json()["email"]  # should return user profile


@pytest.mark.asyncio
async def test_invalid_api_key(client):
    """Invalid X-API-Key returns 401."""
    r = await client.get("/api/v1/auth/me", headers={"X-API-Key": "ag_live_invalid_key_123"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_delete_api_key(client, auth_headers):
    """DELETE /auth/api-keys/{id} deactivates the key."""
    r = await client.post("/api/v1/auth/api-keys", headers=auth_headers, json={"name": "ToDelete"})
    key_id = r.json()["id"]

    r2 = await client.delete(f"/api/v1/auth/api-keys/{key_id}", headers=auth_headers)
    assert r2.status_code == 204
