"""Merge heads after utility files + rubric scale

Revision ID: z9y8x7w6
Revises: a7b8c9d0e1f2, r0s1t2u3, u1v2w3x4
Create Date: 2026-03-17

"""

from typing import Sequence, Union

from alembic import op


revision: str = "z9y8x7w6"
down_revision: Union[str, None] = ("a7b8c9d0e1f2", "r0s1t2u3", "u1v2w3x4")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

