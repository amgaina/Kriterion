"""Add file_size_bytes to submission_files if missing.

Revision ID: p8q9r0s1
Revises: o7p8q9r0
Create Date: 2026-03-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "p8q9r0s1"
down_revision: Union[str, None] = "o7p8q9r0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(conn, table: str, column: str) -> bool:
    result = conn.execute(
        sa.text(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_name = :table AND column_name = :column
            """
        ),
        {"table": table, "column": column},
    )
    return result.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "submission_files", "file_size_bytes"):
        op.add_column(
            "submission_files",
            sa.Column("file_size_bytes", sa.Integer(), nullable=False, server_default=sa.text("0")),
        )


def downgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, "submission_files", "file_size_bytes"):
        op.drop_column("submission_files", "file_size_bytes")
