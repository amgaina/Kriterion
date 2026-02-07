from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class LanguageBase(BaseModel):
    name: str
    display_name: str
    version: Optional[str] = None
    file_extension: str


class LanguageCreate(LanguageBase):
    compile_command: Optional[str] = None
    run_command: str
    docker_image: Optional[str] = None
    default_timeout_seconds: int = 30
    default_memory_mb: int = 256
    is_active: bool = True


class Language(LanguageBase):
    id: int
    compile_command: Optional[str] = None
    run_command: str
    docker_image: Optional[str] = None
    default_timeout_seconds: int
    default_memory_mb: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
