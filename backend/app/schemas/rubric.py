from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class RubricItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    # Percentage weight (0–100) of this criterion in the final score
    weight: float = 0.0
    # Points allocated to this criterion
    points: float = 0.0


class RubricItemCreate(RubricItemBase):
    pass


class RubricItem(RubricItemBase):
    id: int
    
    class Config:
        from_attributes = True
