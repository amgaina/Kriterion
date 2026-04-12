"""Merge all outstanding heads into a single linear tip

Revision ID: cc1dd2ee3ff4
Revises: aa1bb2cc3dd4, a1b2c3d4e5f6g7h8, wt1rb2wt3rb4
Create Date: 2026-04-04

"""
from typing import Sequence, Union
from alembic import op

revision: str = "cc1dd2ee3ff4"
down_revision: Union[str, None] = ("aa1bb2cc3dd4", "a1b2c3d4e5f6g7h8", "wt1rb2wt3rb4")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
