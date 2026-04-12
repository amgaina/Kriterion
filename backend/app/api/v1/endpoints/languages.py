from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.deps import get_db, require_role, get_current_user
from app.models import Language, UserRole, User
from app.schemas.language import Language as LanguageSchema, LanguageWithExtensions
from app.core.language_extensions import get_extensions_for_language

router = APIRouter()


# ── Request schemas ────────────────────────────────────────────────────────────

class LanguageCreateRequest(BaseModel):
    name: str
    display_name: str
    file_extension: str
    run_command: str
    compile_command: Optional[str] = None
    docker_image: Optional[str] = None
    default_timeout_seconds: int = 30
    default_memory_mb: int = 256
    is_active: bool = True


class LanguageUpdateRequest(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    file_extension: Optional[str] = None
    run_command: Optional[str] = None
    compile_command: Optional[str] = None
    docker_image: Optional[str] = None
    default_timeout_seconds: Optional[int] = None
    default_memory_mb: Optional[int] = None
    is_active: Optional[bool] = None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[LanguageWithExtensions])
def get_languages(
    db: Session = Depends(get_db),
    active_only: bool = True,
):
    """Get supported programming languages. Pass active_only=false to include disabled ones."""
    query = db.query(Language)
    if active_only:
        query = query.filter(Language.is_active == True)
    languages = query.order_by(Language.display_name).all()
    result = []
    for lang in languages:
        data = LanguageSchema.model_validate(lang).model_dump()
        data["allowed_extensions"] = get_extensions_for_language(lang.name)
        result.append(LanguageWithExtensions(**data))
    return result


@router.get("/{language_id}", response_model=LanguageSchema)
def get_language(
    language_id: int,
    db: Session = Depends(get_db),
):
    """Get a specific language by ID."""
    language = db.query(Language).filter(Language.id == language_id).first()
    if not language:
        raise HTTPException(status_code=404, detail="Language not found")
    return language


@router.post("/", response_model=LanguageSchema, status_code=status.HTTP_201_CREATED)
def create_language(
    body: LanguageCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    """Create a new programming language (admin only)."""
    existing = db.query(Language).filter(Language.name == body.name.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Language '{body.name}' already exists.")

    language = Language(
        name=body.name.lower().strip(),
        display_name=body.display_name.strip(),
        file_extension=body.file_extension.strip(),
        run_command=body.run_command.strip(),
        compile_command=body.compile_command.strip() if body.compile_command else None,
        docker_image=body.docker_image.strip() if body.docker_image else None,
        default_timeout_seconds=body.default_timeout_seconds,
        default_memory_mb=body.default_memory_mb,
        is_active=body.is_active,
    )
    db.add(language)
    db.commit()
    db.refresh(language)
    return language


@router.put("/{language_id}", response_model=LanguageSchema)
def update_language(
    language_id: int,
    body: LanguageUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    """Update a programming language (admin only)."""
    language = db.query(Language).filter(Language.id == language_id).first()
    if not language:
        raise HTTPException(status_code=404, detail="Language not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(language, field, value)

    db.commit()
    db.refresh(language)
    return language


@router.delete("/{language_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_language(
    language_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    """Delete a programming language (admin only)."""
    language = db.query(Language).filter(Language.id == language_id).first()
    if not language:
        raise HTTPException(status_code=404, detail="Language not found")
    db.delete(language)
    db.commit()
