from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class AuditLog(BaseModel):
    id: int
    user_id: Optional[int] = None
    event_type: str
    description: Optional[str] = None
    ip_address: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class AuditLogCreate(BaseModel):
    user_id: Optional[int] = None
    event_type: str
    description: Optional[str] = None
    ip_address: Optional[str] = None
    status: Optional[str] = "success"
    error_message: Optional[str] = None