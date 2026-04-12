"""RubricItem: name + description; TestCase: expected_output_files_json

Revision ID: k3l4m5n6
Revises: j2k3l4m5
Create Date: 2026-03-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "k3l4m5n6"
down_revision: Union[str, None] = "j2k3l4m5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # rubric_items: replace name_description with name + description
    op.add_column("rubric_items", sa.Column("name", sa.String(255), nullable=True))
    op.add_column("rubric_items", sa.Column("description", sa.Text(), nullable=True))
    conn = op.get_bind()
    dialect = conn.dialect.name
    if dialect == "postgresql":
        conn.execute(
            sa.text(
                "UPDATE rubric_items SET name = COALESCE(SUBSTRING(name_description FROM 1 FOR 255), ''), description = NULL"
            )
        )
    else:
        conn.execute(
            sa.text(
                "UPDATE rubric_items SET name = COALESCE(SUBSTR(name_description, 1, 255), ''), description = NULL"
            )
        )
    op.drop_column("rubric_items", "name_description")
    op.alter_column(
        "rubric_items",
        "name",
        existing_type=sa.String(255),
        nullable=False,
    )

    # test_cases: multiple expected output files
    op.add_column("test_cases", sa.Column("expected_output_files_json", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("test_cases", "expected_output_files_json")

    op.add_column("rubric_items", sa.Column("name_description", sa.Text(), nullable=True))
    conn = op.get_bind()
    conn.execute(sa.text("UPDATE rubric_items SET name_description = COALESCE(name, '') WHERE name_description IS NULL"))
    op.drop_column("rubric_items", "name")
    op.drop_column("rubric_items", "description")
    op.alter_column("rubric_items", "name_description", existing_type=sa.Text(), nullable=False)
