import pytest
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.config import settings
from app.services.plan_enforcement import (
    get_plan_limits,
    get_org_plan,
    check_project_limit,
    check_cli_tools_limit,
    check_member_limit,
    check_premium_skill,
    upgrade_org_to_premium,
)
from app.models.organization import Organization, OrganizationMember
from app.models.project import Project
from app.models.environment import EnvironmentProfile
from app.models.user import User


def test_get_plan_limits():
    """Test get_plan_limits for different tiers."""
    # Enterprise
    enterprise_limits = get_plan_limits("enterprise")
    assert enterprise_limits["max_projects"] == 999999
    assert enterprise_limits["max_cli_tools"] == 999999
    assert enterprise_limits["max_members"] == 999999
    assert enterprise_limits["skills_parallel"] is True

    # Premium
    premium_limits = get_plan_limits("premium")
    assert premium_limits["max_projects"] == settings.premium_max_projects
    assert premium_limits["max_cli_tools"] == settings.premium_max_cli_tools
    assert premium_limits["max_members"] == settings.premium_max_members
    assert premium_limits["skills_parallel"] is True

    # Free (default)
    free_limits = get_plan_limits("free")
    assert free_limits["max_projects"] == settings.free_max_projects
    assert free_limits["max_cli_tools"] == settings.free_max_cli_tools
    assert free_limits["max_members"] == settings.free_max_members
    assert free_limits["skills_parallel"] is False

    # Any other value defaults to free
    other_limits = get_plan_limits("invalid_plan")
    assert other_limits["max_projects"] == settings.free_max_projects

@pytest.mark.asyncio
async def test_get_org_plan(db: AsyncSession):
    """Test retrieving an organization's plan."""
    # Test for non-existent org defaults to "free"
    plan = await get_org_plan(db, "nonexistent-id")
    assert plan == "free"

    # Create an organization with "premium" plan
    user = User(email="org_owner@test.com", hashed_password="pw", display_name="Owner")
    db.add(user)
    await db.commit()
    await db.refresh(user)

    org = Organization(
        name="Test Org",
        slug="test-org",
        owner_id=user.id,
        plan="premium",
        max_projects=settings.premium_max_projects,
        max_members=settings.premium_max_members
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)

    plan = await get_org_plan(db, org.id)
    assert plan == "premium"

@pytest.mark.asyncio
async def test_check_project_limit(db: AsyncSession):
    """Test project limit enforcement."""
    # Create user and org with 1 max project
    user = User(email="proj_owner@test.com", hashed_password="pw", display_name="Owner")
    db.add(user)
    await db.commit()
    await db.refresh(user)

    org = Organization(
        name="Limit Org",
        slug="limit-org",
        owner_id=user.id,
        plan="free",
        max_projects=3,
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)

    # 0 projects - should pass
    await check_project_limit(db, org.id)

    # Add free_max_projects active projects
    for i in range(settings.free_max_projects):
        proj = Project(
            org_id=org.id,
            name=f"Project {i}",
            slug=f"project-{i}",
            is_active=True
        )
        db.add(proj)
    await db.commit()

    # Next project check should fail
    with pytest.raises(ValueError, match="máximo 3 proyectos"):
        await check_project_limit(db, org.id)

@pytest.mark.asyncio
async def test_check_cli_tools_limit(db: AsyncSession):
    """Test CLI tools limit enforcement across all environments in a project."""
    user = User(email="cli_owner@test.com", hashed_password="pw", display_name="Owner")
    db.add(user)
    await db.commit()
    await db.refresh(user)

    org = Organization(
        name="CLI Org",
        slug="cli-org",
        owner_id=user.id,
        plan="free"
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)

    proj = Project(org_id=org.id, name="CLI Proj", slug="cli-proj")
    db.add(proj)
    await db.commit()
    await db.refresh(proj)

    # Free plan default allows up to settings.free_max_cli_tools tools
    limit = settings.free_max_cli_tools

    # Add limits-1 tools in one environment
    env1 = EnvironmentProfile(
        project_id=proj.id,
        name="dev",
        environment="development",
        cli_profiles=[{"tool": f"tool{i}"} for i in range(limit - 1)]
    )
    db.add(env1)
    await db.commit()

    # We are under the limit, should pass
    await check_cli_tools_limit(db, org.id, proj.id, new_profiles_count=1)

    # Adding 2 would put us at (limit - 1) + 2 = limit + 1, exceeding limit
    with pytest.raises(ValueError, match=f"máximo {limit} CLI tools"):
        await check_cli_tools_limit(db, org.id, proj.id, new_profiles_count=2)

    # Add another environment with 1 tool (hitting the limit)
    env2 = EnvironmentProfile(
        project_id=proj.id,
        name="prod",
        environment="production",
        cli_profiles=[{"tool": "prod-tool1"}]
    )
    db.add(env2)
    await db.commit()

    # Now we are at limit, adding 1 more should fail
    with pytest.raises(ValueError, match=f"máximo {limit} CLI tools"):
        await check_cli_tools_limit(db, org.id, proj.id, new_profiles_count=1)

@pytest.mark.asyncio
async def test_check_member_limit(db: AsyncSession):
    """Test org member limit enforcement."""
    user = User(email="member_owner@test.com", hashed_password="pw", display_name="Owner")
    db.add(user)
    await db.commit()
    await db.refresh(user)

    org = Organization(
        name="Member Org",
        slug="member-org",
        owner_id=user.id,
        plan="free"
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)

    limit = settings.free_max_members

    # Free plan default is usually 1, so owner takes it up if they are in OrganizationMember table.
    # Currently, 0 members in OrganizationMember table.
    # We should be able to check limits and pass if current members (0) < limit
    await check_member_limit(db, org.id)

    # Let's add members up to the limit
    for i in range(limit):
        u = User(email=f"m{i}@test.com", hashed_password="pw")
        db.add(u)
        await db.commit()
        await db.refresh(u)

        m = OrganizationMember(org_id=org.id, user_id=u.id, role="member")
        db.add(m)
    await db.commit()

    # Now we are at the limit, should fail
    with pytest.raises(ValueError, match=f"máximo {limit} miembros"):
        await check_member_limit(db, org.id)

@pytest.mark.asyncio
async def test_check_premium_skill(db: AsyncSession):
    """Test checking if a skill is premium vs plan."""
    user = User(email="skill_owner@test.com", hashed_password="pw")
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Free Org
    free_org = Organization(
        name="Free Org",
        slug="free-org-skill",
        owner_id=user.id,
        plan="free"
    )
    db.add(free_org)

    # Premium Org
    premium_org = Organization(
        name="Premium Org",
        slug="premium-org-skill",
        owner_id=user.id,
        plan="premium"
    )
    db.add(premium_org)
    await db.commit()

    # Free org, non-premium skill - passes
    await check_premium_skill(db, free_org.id, is_premium_skill=False)

    # Free org, premium skill - fails
    with pytest.raises(ValueError, match="requieren el plan Premium"):
        await check_premium_skill(db, free_org.id, is_premium_skill=True)

    # Premium org, non-premium skill - passes
    await check_premium_skill(db, premium_org.id, is_premium_skill=False)

    # Premium org, premium skill - passes
    await check_premium_skill(db, premium_org.id, is_premium_skill=True)

@pytest.mark.asyncio
async def test_upgrade_org_to_premium(db: AsyncSession):
    """Test upgrading an organization updates its plan and limits."""
    user = User(email="upgrade_owner@test.com", hashed_password="pw")
    db.add(user)
    await db.commit()
    await db.refresh(user)

    org = Organization(
        name="Upgrade Org",
        slug="upgrade-org",
        owner_id=user.id,
        plan="free",
        max_projects=settings.free_max_projects,
        max_members=settings.free_max_members
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)

    # Before upgrade
    assert org.plan == "free"

    # Execute upgrade
    await upgrade_org_to_premium(db, org.id)
    await db.commit()
    await db.refresh(org)

    # After upgrade
    assert org.plan == "premium"
    assert org.max_projects == settings.premium_max_projects
    assert org.max_members == settings.premium_max_members
