"""Merge migration heads: f6a7b8c9d0e1 and k3l4m5n6

Revision ID: m5n6o7p8
Revises: f6a7b8c9d0e1, k3l4m5n6
Create Date: 2026-03-15

"""
from typing import Sequence, Union

from alembic import op


revision: str = "m5n6o7p8"
down_revision: Union[str, None] = ("f6a7b8c9d0e1", "k3l4m5n6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
