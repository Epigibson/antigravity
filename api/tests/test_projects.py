"""Project CRUD endpoint tests."""

import pytest


@pytest.mark.asyncio
async def test_list_projects_empty(client, auth_headers):
    """GET /projects/ with no projects returns empty list."""
    r = await client.get("/api/v1/projects/", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_create_project(client, auth_headers):
    """POST /projects/ creates a new project."""
    r = await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Test Project",
        "slug": "test-project",
        "description": "A test project",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Test Project"
    assert data["slug"] == "test-project"
    assert isinstance(data["environments"], list)
    assert isinstance(data["skills"], list)


@pytest.mark.asyncio
async def test_get_project_by_slug(client, auth_headers):
    """GET /projects/{slug} returns created project."""
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Slug Test", "slug": "slug-test",
    })
    r = await client.get("/api/v1/projects/slug-test", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["name"] == "Slug Test"


@pytest.mark.asyncio
async def test_get_nonexistent_project(client, auth_headers):
    """GET /projects/{slug} with bad slug returns 404."""
    r = await client.get("/api/v1/projects/nonexistent", headers=auth_headers)
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_project(client, auth_headers):
    """PUT /projects/{slug} updates description."""
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Update Me", "slug": "update-me",
    })
    r = await client.put("/api/v1/projects/update-me", headers=auth_headers, json={
        "description": "Updated desc",
    })
    assert r.status_code == 200
    assert r.json()["description"] == "Updated desc"


@pytest.mark.asyncio
async def test_delete_project(client, auth_headers):
    """DELETE /projects/{slug} soft-deletes the project."""
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Delete Me", "slug": "delete-me",
    })
    r = await client.delete("/api/v1/projects/delete-me", headers=auth_headers)
    assert r.status_code == 204

    # Should not appear in listing anymore
    r = await client.get("/api/v1/projects/", headers=auth_headers)
    slugs = [p["slug"] for p in r.json()]
    assert "delete-me" not in slugs


@pytest.mark.asyncio
async def test_duplicate_slug_rejected(client, auth_headers):
    """POST /projects/ with duplicate slug returns 400."""
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "First", "slug": "unique-slug",
    })
    r = await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Second", "slug": "unique-slug",
    })
    assert r.status_code == 400
    assert "already exists" in r.json()["detail"]


@pytest.mark.asyncio
async def test_projects_require_auth(client):
    """Projects endpoints without auth return 401."""
    assert (await client.get("/api/v1/projects/")).status_code == 401
    assert (await client.post("/api/v1/projects/", json={"name": "x", "slug": "x"})).status_code == 401


@pytest.mark.asyncio
async def test_freemium_limit(client, auth_headers):
    """Free plan limits to 3 projects."""
    for i in range(3):
        r = await client.post("/api/v1/projects/", headers=auth_headers, json={
            "name": f"Proj {i}", "slug": f"proj-{i}",
        })
        assert r.status_code == 201

    # 4th should fail
    r = await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Proj 4", "slug": "proj-4",
    })
    assert r.status_code == 400
    assert "limit" in r.json()["detail"].lower()
