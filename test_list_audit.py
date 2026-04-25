import asyncio
from sqlalchemy import select, desc
from app.database import async_session
from app.models.audit import AuditLog
from app.models.project import Project

async def test():
    async with async_session() as db:
        query = (
            select(AuditLog, Project.name.label("project_name"))
            .outerjoin(Project, AuditLog.project_id == Project.id)
        )
        query = query.order_by(desc(AuditLog.created_at)).offset(0).limit(15)
        try:
            result = await db.execute(query)
            rows = result.all()
            print("Found", len(rows), "rows")
            for e, project_name in rows:
                pass
        except Exception as ex:
            import traceback
            traceback.print_exc()

asyncio.run(test())
