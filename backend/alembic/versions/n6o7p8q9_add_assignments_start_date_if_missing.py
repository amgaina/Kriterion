"""Add assignments.start_date if missing (fix DBs that were stamped without full mainline).

Revision ID: n6o7p8q9
Revises: m5n6o7p8
Create Date: 2026-03-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "n6o7p8q9"
down_revision: Union[str, None] = "m5n6o7p8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'start_date'"
        )
    )
    if result.scalar() is None:
        op.add_column("assignments", sa.Column("start_date", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("assignments", "start_date")
