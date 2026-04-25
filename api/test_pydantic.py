import enum
from pydantic import BaseModel

class AuditAction(str, enum.Enum):
    context_switch = "context_switch"

class AuditEntryResponse(BaseModel):
    id: str
    action: str

try:
    obj = AuditEntryResponse(id="123", action=AuditAction.context_switch)
    print("Success:", obj.model_dump())
except Exception as e:
    print("Error:", e)
