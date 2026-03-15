"""Add rubric points; remove test_code, setup_code, teardown_code, is_sample from test_cases.

Revision ID: o7p8q9r0
Revises: n6o7p8q9
Create Date: 2026-03-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "o7p8q9r0"
down_revision: Union[str, None] = "n6o7p8q9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add points to rubrics (per-criterion points)
    op.add_column("rubrics", sa.Column("points", sa.Float(), nullable=True, server_default=sa.text("0")))

    # Drop TestCase columns: test_code, setup_code, teardown_code, is_sample
    op.drop_column("test_cases", "test_code")
    op.drop_column("test_cases", "setup_code")
    op.drop_column("test_cases", "teardown_code")
    op.drop_column("test_cases", "is_sample")


def downgrade() -> None:
    op.add_column("test_cases", sa.Column("is_sample", sa.Boolean(), nullable=True, server_default=sa.false()))
    op.add_column("test_cases", sa.Column("teardown_code", sa.Text(), nullable=True))
    op.add_column("test_cases", sa.Column("setup_code", sa.Text(), nullable=True))
    op.add_column("test_cases", sa.Column("test_code", sa.Text(), nullable=True))
    op.drop_column("rubrics", "points")
