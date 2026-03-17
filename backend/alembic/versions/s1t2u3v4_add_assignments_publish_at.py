"""Add publish_at to assignments for scheduled publishing.

Revision ID: s1t2u3v4
Revises: r0s1t2u3
Create Date: 2026-03-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "s1t2u3v4"
down_revision: Union[str, None] = "r0s1t2u3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("assignments", sa.Column("publish_at", sa.DateTime(), nullable=True))
    op.create_index("ix_assignments_publish_at", "assignments", ["publish_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_assignments_publish_at", table_name="assignments")
    op.drop_column("assignments", "publish_at")
