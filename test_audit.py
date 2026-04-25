import asyncio
from app.database import async_session
from sqlalchemy import select
from app.models.audit import AuditLog

async def main():
    async with async_session() as db:
        res = await db.execute(select(AuditLog.project_id, AuditLog.message).limit(10))
        print("Logs in DB:")
        for r in res:
            print(r)

asyncio.run(main())
