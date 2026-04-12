"""Remove starter/solution, add utility files + rubric scale

Revision ID: u1v2w3x4
Revises: m5n6o7p8
Create Date: 2026-03-17

"""

from typing import Sequence, Union
import json

from alembic import op
import sqlalchemy as sa


revision: str = "u1v2w3x4"
down_revision: Union[str, None] = "m5n6o7p8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New: utility file metadata + rubric scale bounds
    op.add_column("assignments", sa.Column("utility_files_json", sa.JSON(), nullable=True))
    op.add_column("assignments", sa.Column("rubric_min_points", sa.Float(), nullable=False, server_default="0"))
    op.add_column("assignments", sa.Column("rubric_max_points", sa.Float(), nullable=False, server_default="10"))

    # Migrate existing supplementary file refs from starter_code JSON (best-effort)
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, starter_code FROM assignments WHERE starter_code IS NOT NULL")).fetchall()
    for assignment_id, starter_code in rows:
        if not isinstance(starter_code, str) or not starter_code.strip():
            continue
        try:
            payload = json.loads(starter_code)
        except Exception:
            continue
        supp = payload.get("supplementary")
        if isinstance(supp, list) and supp:
            bind.execute(
                sa.text("UPDATE assignments SET utility_files_json = :supp WHERE id = :id").bindparams(
                    sa.bindparam("supp", type_=sa.JSON())
                ),
                {"supp": supp, "id": assignment_id},
            )

    # Drop legacy columns
    op.drop_column("assignments", "solution_code")
    op.drop_column("assignments", "starter_code")


def downgrade() -> None:
    op.add_column("assignments", sa.Column("starter_code", sa.Text(), nullable=True))
    op.add_column("assignments", sa.Column("solution_code", sa.Text(), nullable=True))
    op.drop_column("assignments", "rubric_max_points")
    op.drop_column("assignments", "rubric_min_points")
    op.drop_column("assignments", "utility_files_json")

