from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.models import Language, UserRole
from app.schemas.language import Language as LanguageSchema, LanguageWithExtensions
from app.core.language_extensions import get_extensions_for_language

router = APIRouter()


@router.get("/", response_model=List[LanguageWithExtensions])
def get_languages(
    db: Session = Depends(get_db),
    active_only: bool = True,
):
    """Get all supported programming languages with allowed file extensions for assignments"""
    query = db.query(Language)
    if active_only:
        query = query.filter(Language.is_active == True)
    languages = query.all()
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
    """Get a specific language by ID"""
    language = db.query(Language).filter(Language.id == language_id).first()
    if not language:
        raise HTTPException(status_code=404, detail="Language not found")
    return language
