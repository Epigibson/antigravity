"""Environment CRUD + CLI Profile management tests.

Tests the full lifecycle:
 - Create environments (dev/staging/prod)
 - Update environments (git branch, env vars)
 - Add/update/remove CLI profiles
 - Delete environments
 - Manage environment variables (API keys, secrets)
"""

import pytest


# ─── Environment CRUD ───


@pytest.mark.asyncio
async def test_create_environment(client, auth_headers):
    """POST /projects/{slug}/environments creates a new env."""
    # Create project first
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Env Test", "slug": "env-test",
    })

    r = await client.post("/api/v1/projects/env-test/environments", headers=auth_headers, json={
        "name": "development",
        "environment": "development",
        "git_branch": "develop",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "development"
    assert data["environment"] == "development"
    assert data["git_branch"] == "develop"
    assert data["cli_profiles"] == []
    assert data["env_var_count"] == 0


@pytest.mark.asyncio
async def test_create_multiple_environments(client, auth_headers):
    """A project can have dev, staging, and production environments."""
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Multi Env", "slug": "multi-env",
    })

    for env_name, branch in [("development", "develop"), ("staging", "staging"), ("production", "main")]:
        r = await client.post("/api/v1/projects/multi-env/environments", headers=auth_headers, json={
            "name": env_name, "environment": env_name, "git_branch": branch,
        })
        assert r.status_code == 201

    # Verify all 3 appear in project
    r = await client.get("/api/v1/projects/multi-env", headers=auth_headers)
    assert len(r.json()["environments"]) == 3


@pytest.mark.asyncio
async def test_update_environment_branch(client, auth_headers):
    """PUT /projects/{slug}/environments/{name} updates the branch."""
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Branch Test", "slug": "branch-test",
    })
    await client.post("/api/v1/projects/branch-test/environments", headers=auth_headers, json={
        "name": "production", "environment": "production", "git_branch": "main",
    })

    r = await client.put("/api/v1/projects/branch-test/environments/production",
                         headers=auth_headers, json={"git_branch": "release/v2"})
    assert r.status_code == 200
    assert r.json()["git_branch"] == "release/v2"


@pytest.mark.asyncio
async def test_delete_environment(client, auth_headers):
    """DELETE /projects/{slug}/environments/{name} removes the env."""
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Del Env", "slug": "del-env",
    })
    await client.post("/api/v1/projects/del-env/environments", headers=auth_headers, json={
        "name": "staging", "environment": "staging",
    })

    r = await client.delete("/api/v1/projects/del-env/environments/staging", headers=auth_headers)
    assert r.status_code == 204

    # Verify it's gone
    r = await client.get("/api/v1/projects/del-env", headers=auth_headers)
    env_names = [e["name"] for e in r.json()["environments"]]
    assert "staging" not in env_names


@pytest.mark.asyncio
async def test_delete_nonexistent_environment(client, auth_headers):
    """DELETE a non-existent env returns 404."""
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "No Env", "slug": "no-env",
    })
    r = await client.delete("/api/v1/projects/no-env/environments/ghost", headers=auth_headers)
    assert r.status_code == 404


# ─── CLI Profiles (within environments) ───


@pytest.mark.asyncio
async def test_add_cli_profile(client, auth_headers):
    """Adding a CLI profile via environment update stores it correctly."""
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Profile Test", "slug": "profile-test",
    })
    await client.post("/api/v1/projects/profile-test/environments", headers=auth_headers, json={
        "name": "production", "environment": "production", "git_branch": "main",
    })

    # Add GitHub profile
    r = await client.put("/api/v1/projects/profile-test/environments/production",
                         headers=auth_headers, json={
        "cli_profiles": [
            {"tool": "gh", "account": "epigibson", "org": "autohotel-dev", "status": "connected"},
        ],
    })
    assert r.status_code == 200
    profiles = r.json()["cli_profiles"]
    assert len(profiles) == 1
    assert profiles[0]["tool"] == "gh"
    assert profiles[0]["account"] == "epigibson"
    assert profiles[0]["org"] == "autohotel-dev"


@pytest.mark.asyncio
async def test_add_multiple_cli_profiles(client, auth_headers):
    """Multiple CLI profiles can be added to a single environment."""
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Multi Profile", "slug": "multi-profile",
    })
    await client.post("/api/v1/projects/multi-profile/environments", headers=auth_headers, json={
        "name": "production", "environment": "production",
    })

    profiles = [
        {"tool": "gh", "account": "epigibson", "status": "connected"},
        {"tool": "aws", "account": "luxor-prod", "region": "us-east-1", "status": "connected"},
        {"tool": "supabase", "account": "abcdefghijk", "region": "us-east-1", "status": "connected"},
    ]

    r = await client.put("/api/v1/projects/multi-profile/environments/production",
                         headers=auth_headers, json={"cli_profiles": profiles})
    assert r.status_code == 200
    saved = r.json()["cli_profiles"]
    assert len(saved) == 3
    tools = [p["tool"] for p in saved]
    assert "gh" in tools
    assert "aws" in tools
    assert "supabase" in tools


@pytest.mark.asyncio
async def test_update_cli_profile(client, auth_headers):
    """Updating profiles replaces the entire profile list."""
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Update Profile", "slug": "update-profile",
    })
    await client.post("/api/v1/projects/update-profile/environments", headers=auth_headers, json={
        "name": "dev", "environment": "development",
    })

    # Add initial profile
    await client.put("/api/v1/projects/update-profile/environments/dev",
                     headers=auth_headers, json={
        "cli_profiles": [{"tool": "gh", "account": "old-account", "status": "connected"}],
    })

    # Update with new account
    r = await client.put("/api/v1/projects/update-profile/environments/dev",
                         headers=auth_headers, json={
        "cli_profiles": [{"tool": "gh", "account": "new-account", "status": "connected"}],
    })
    assert r.status_code == 200
    assert r.json()["cli_profiles"][0]["account"] == "new-account"


@pytest.mark.asyncio
async def test_remove_cli_profile(client, auth_headers):
    """Sending empty profiles list clears all profiles."""
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Clear Profile", "slug": "clear-profile",
    })
    await client.post("/api/v1/projects/clear-profile/environments", headers=auth_headers, json={
        "name": "dev", "environment": "development",
    })

    # Add profile
    await client.put("/api/v1/projects/clear-profile/environments/dev",
                     headers=auth_headers, json={
        "cli_profiles": [{"tool": "gh", "account": "test", "status": "connected"}],
    })

    # Clear profiles
    r = await client.put("/api/v1/projects/clear-profile/environments/dev",
                         headers=auth_headers, json={"cli_profiles": []})
    assert r.status_code == 200
    assert r.json()["cli_profiles"] == []


# ─── Environment Variables (API Keys, Secrets) ───


@pytest.mark.asyncio
async def test_set_env_vars(client, auth_headers):
    """Environment variables can be stored per environment."""
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Env Vars", "slug": "env-vars",
    })
    await client.post("/api/v1/projects/env-vars/environments", headers=auth_headers, json={
        "name": "production", "environment": "production",
    })

    r = await client.put("/api/v1/projects/env-vars/environments/production",
                         headers=auth_headers, json={
        "env_vars": {
            "DATABASE_URL": "postgresql://user:pass@host:5432/db",
            "SUPABASE_URL": "https://abc.supabase.co",
            "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiJ9",
            "AWS_ACCESS_KEY_ID": "AKIAIOSFODNN7EXAMPLE",
        },
    })
    assert r.status_code == 200
    data = r.json()
    assert data["env_var_count"] == 4
    # Keys should be visible
    assert "DATABASE_URL" in data["env_var_keys"]
    assert "AWS_ACCESS_KEY_ID" in data["env_var_keys"]
    # Values should be masked (first 4 chars + dots)
    assert data["env_vars"]["DATABASE_URL"] == "••••"
    assert data["env_vars"]["AWS_ACCESS_KEY_ID"] == "••••"


@pytest.mark.asyncio
async def test_env_vars_update_partial(client, auth_headers):
    """Updating env vars replaces ALL vars (not merge)."""
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Partial Vars", "slug": "partial-vars",
    })
    await client.post("/api/v1/projects/partial-vars/environments", headers=auth_headers, json={
        "name": "dev", "environment": "development",
        "env_vars": {"KEY_A": "a", "KEY_B": "b"},
    })

    # Update with only KEY_C
    r = await client.put("/api/v1/projects/partial-vars/environments/dev",
                         headers=auth_headers, json={
        "env_vars": {"KEY_C": "c"},
    })
    assert r.status_code == 200
    assert r.json()["env_var_count"] == 1  # replaced, not merged


@pytest.mark.asyncio
async def test_create_env_with_vars(client, auth_headers):
    """Environment can be created with initial env vars."""
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Init Vars", "slug": "init-vars",
    })

    r = await client.post("/api/v1/projects/init-vars/environments", headers=auth_headers, json={
        "name": "production",
        "environment": "production",
        "env_vars": {
            "RAILWAY_TOKEN": "xxx",
            "DATABASE_URL": "postgres://...",
        },
    })
    assert r.status_code == 201
    assert r.json()["env_var_count"] == 2


@pytest.mark.asyncio
async def test_create_env_with_profiles_and_vars(client, auth_headers):
    """Full environment with profiles AND vars in one go."""
    await client.post("/api/v1/projects/", headers=auth_headers, json={
        "name": "Full Env", "slug": "full-env",
    })

    r = await client.post("/api/v1/projects/full-env/environments", headers=auth_headers, json={
        "name": "production",
        "environment": "production",
        "git_branch": "main",
        "env_vars": {
            "DATABASE_URL": "postgres://prod:5432/db",
            "SUPABASE_KEY": "prod-key",
        },
        "cli_profiles": [
            {"tool": "gh", "account": "epigibson", "status": "connected"},
            {"tool": "aws", "account": "luxor-prod", "region": "us-east-1", "status": "connected"},
        ],
    })
    assert r.status_code == 201
    data = r.json()
    assert data["env_var_count"] == 2
    assert len(data["cli_profiles"]) == 2
    assert data["git_branch"] == "main"


# ─── Auth guards ───


@pytest.mark.asyncio
async def test_env_requires_auth(client):
    """Environment endpoints require authentication."""
    r = await client.post("/api/v1/projects/any/environments", json={"name": "x", "environment": "development"})
    assert r.status_code == 401

    r = await client.put("/api/v1/projects/any/environments/x", json={})
    assert r.status_code == 401

    r = await client.delete("/api/v1/projects/any/environments/x")
    assert r.status_code == 401
