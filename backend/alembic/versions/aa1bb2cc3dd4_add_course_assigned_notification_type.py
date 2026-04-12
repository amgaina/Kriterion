"""Add course_assigned notification type

Revision ID: aa1bb2cc3dd4
Revises: y1x2w3v4
Create Date: 2026-03-29

"""
from typing import Sequence, Union

from alembic import op


revision: str = "aa1bb2cc3dd4"
down_revision: Union[str, None] = "y1x2w3v4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'course_assigned'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values; no-op
    pass
