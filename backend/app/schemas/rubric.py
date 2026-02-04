from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class RubricBase(BaseModel):
    total_points: float = 30.0


class RubricCreate(RubricBase):
    assignment_id: int


class Rubric(RubricBase):
    id: int
    assignment_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class RubricCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    weight: float = 1.0
    order: int = 0


class RubricCategoryCreate(RubricCategoryBase):
    rubric_id: int


class RubricCategory(RubricCategoryBase):
    id: int
    rubric_id: int
    
    class Config:
        from_attributes = True


class RubricItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    max_points: float = 5.0
    order: int = 0


class RubricItemCreate(RubricItemBase):
    category_id: int


class RubricItem(RubricItemBase):
    id: int
    category_id: int
    
    class Config:
        from_attributes = True
