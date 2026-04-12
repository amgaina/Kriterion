"""Merge remaining heads (notifications cascade + app schema)

Revision ID: y1x2w3v4
Revises: f6a7b8c9d0e2, z9y8x7w6
Create Date: 2026-03-17

"""

from typing import Sequence, Union

from alembic import op


revision: str = "y1x2w3v4"
down_revision: Union[str, None] = ("f6a7b8c9d0e2", "z9y8x7w6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

