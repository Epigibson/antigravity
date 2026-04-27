"""Smoke tests — verify all modules import without errors.

These tests would have caught the SkillDefinition vs Skill ImportError.
"""


def test_models_import():
    """All models should import cleanly."""
    from app.models.user import User
    from app.models.organization import Organization, OrganizationMember
    from app.models.project import Project
    from app.models.environment import EnvironmentProfile
    from app.models.skill import SkillDefinition, SkillConfiguration
    from app.models.audit import AuditLog
    from app.models.api_key import ApiKey
    assert User
    assert Organization
    assert Project
    assert SkillDefinition


def test_services_import():
    """All services should import cleanly."""
    from app.services.auth_service import (
        register_user, authenticate_user, create_access_token, decode_token,
    )
    from app.services.project_service import (
        list_projects, get_project_by_slug, create_project,
        update_project, delete_project,
    )
    assert register_user
    assert list_projects
    assert create_project


def test_routers_import():
    """All routers should import without errors."""
    from app.routers import auth, projects, skills, audit, dashboard
    assert auth.router
    assert projects.router
    assert skills.router
    assert audit.router
    assert dashboard.router


def test_app_import():
    """The FastAPI app should be importable (uvicorn entrypoint)."""
    from app.main import app
    assert app
    assert app.title == "Nexus API"


def test_config_import():
    """Config and settings should load."""
    from app.config import settings
    assert settings.app_name == "Nexus API"
    assert settings.cors_origins  # should have at least one origin


def test_cors_parser_json():
    """CORS parser should handle JSON arrays + auto-add localhost."""
    from app.config import Settings
    s = Settings(cors_origins='["http://a.com","http://b.com"]', secret_key="test", encryption_key="gZz3p44P624ZzYGBa8qL4Vqof9w4d7S0AILv6Ew8zZ0=")
    assert "http://a.com" in s.cors_origins
    assert "http://b.com" in s.cors_origins
    assert "http://localhost:3000" in s.cors_origins


def test_cors_parser_csv():
    """CORS parser should handle comma-separated strings + auto-add localhost."""
    from app.config import Settings
    s = Settings(cors_origins="http://a.com,http://b.com", secret_key="test", encryption_key="gZz3p44P624ZzYGBa8qL4Vqof9w4d7S0AILv6Ew8zZ0=")
    assert "http://a.com" in s.cors_origins
    assert "http://b.com" in s.cors_origins
    assert "http://localhost:3000" in s.cors_origins


def test_cors_parser_single():
    """CORS parser should handle a single URL + auto-add localhost."""
    from app.config import Settings
    s = Settings(cors_origins="http://a.com", secret_key="test", encryption_key="gZz3p44P624ZzYGBa8qL4Vqof9w4d7S0AILv6Ew8zZ0=")
    assert "http://a.com" in s.cors_origins
    assert "http://localhost:3000" in s.cors_origins
