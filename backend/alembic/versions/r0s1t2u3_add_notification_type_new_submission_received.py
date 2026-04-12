"""Add NEW_SUBMISSION_RECEIVED (and related) to notificationtype enum if missing.

Revision ID: r0s1t2u3
Revises: q9r0s1t2
Create Date: 2026-03-15

"""
from typing import Sequence, Union

from alembic import op


revision: str = "r0s1t2u3"
down_revision: Union[str, None] = "q9r0s1t2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add enum values that may be missing (IF NOT EXISTS is idempotent in PG 9.5+)
    for value in (
        "NEW_SUBMISSION_RECEIVED",
        "GRADE_POSTED",
        "HOMEWORK_POSTED",
        "HOMEWORK_DUE",
        "GRADING_PENDING",
        "NEW_USER_REGISTERED",
        "COURSE_APPROVAL_REQUIRED",
        "SYSTEM_ALERT",
    ):
        op.execute(f"ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values; no-op
    pass
