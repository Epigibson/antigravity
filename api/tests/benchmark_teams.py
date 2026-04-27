import asyncio
import time
import uuid

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.database import Base
from app.models.user import User
from app.models.organization import Organization, OrganizationMember, OrgRole
from app.routers.teams import list_members
from sqlalchemy.orm import selectinload

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

async def run_benchmark():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    TestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSession() as db:
        # Create owner
        owner = User(id=str(uuid.uuid4()), email="owner@test.com", hashed_password="hash")
        db.add(owner)
        await db.commit()

        # Create org
        org = Organization(id=str(uuid.uuid4()), name="Test Org", slug="test-org", owner_id=owner.id)
        db.add(org)
        await db.commit()

        # Create 100 members
        num_members = 100
        for i in range(num_members):
            user = User(id=str(uuid.uuid4()), email=f"user{i}@test.com", hashed_password="hash")
            db.add(user)
            member = OrganizationMember(org_id=org.id, user_id=user.id, role=OrgRole.member)
            db.add(member)

        await db.commit()

    async with TestSession() as db:
        result = await db.execute(
            __import__('sqlalchemy').select(User).where(User.id == owner.id)
        )
        owner_loaded = result.scalar_one()

        start = time.perf_counter()
        # call list_members
        members = await list_members(user=owner_loaded, db=db)
        end = time.perf_counter()

        print(f"Time to list {len(members)} members: {end - start:.4f} seconds")

if __name__ == "__main__":
    asyncio.run(run_benchmark())
