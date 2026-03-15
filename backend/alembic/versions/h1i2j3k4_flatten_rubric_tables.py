"""Flatten rubric tables: remove categories, add rubric_items + rubrics (assignment-item link)

Revision ID: h1i2j3k4
Revises: g8c9d0e1f2a3
Create Date: 2026-03-10 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "h1i2j3k4"
down_revision: Union[str, None] = "g8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create new rubric_items table (flat items with name_description)
    op.create_table(
        "rubric_items_new",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name_description", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Create new rubrics table linking assignments to items
    op.create_table(
        "rubrics_new",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("assignments.id"), nullable=False, index=True),
        sa.Column("rubric_item_id", sa.Integer(), sa.ForeignKey("rubric_items_new.id"), nullable=False, index=True),
        sa.Column("weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("max_points", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Re-point rubric_scores.rubric_item_id to new rubric_items_new table
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    fkeys = inspector.get_foreign_keys("rubric_scores")
    for fk in fkeys:
        if fk.get("referred_table") == "rubric_items":
            op.drop_constraint(fk["name"], "rubric_scores", type_="foreignkey")
            break

    op.create_foreign_key(
        "rubric_scores_rubric_item_id_fkey",
        "rubric_scores",
        "rubric_items_new",
        ["rubric_item_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Drop old tables and rename new ones
    op.drop_table("rubric_items")
    op.drop_table("rubric_categories")
    op.drop_table("rubrics")

    op.rename_table("rubric_items_new", "rubric_items")
    op.rename_table("rubrics_new", "rubrics")


def downgrade() -> None:
    # Best-effort downgrade: recreate minimal old structure
    op.rename_table("rubric_items", "rubric_items_new")
    op.rename_table("rubrics", "rubrics_new")

    op.create_table(
        "rubrics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("assignments.id"), nullable=False, unique=True),
        sa.Column("total_points", sa.Float(), nullable=False, server_default="30.0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "rubric_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("rubric_id", sa.Integer(), sa.ForeignKey("rubrics.id"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("weight", sa.Float(), nullable=False, server_default="100.0"),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "rubric_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("rubric_categories.id"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("max_points", sa.Float(), nullable=False, server_default="5.0"),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
    )

    # Restore rubric_scores FK to rubric_items
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    fkeys = inspector.get_foreign_keys("rubric_scores")
    for fk in fkeys:
        if fk.get("referred_table") == "rubric_items_new":
            op.drop_constraint(fk["name"], "rubric_scores", type_="foreignkey")
            break

    op.create_foreign_key(
        "rubric_scores_rubric_item_id_fkey",
        "rubric_scores",
        "rubric_items",
        ["rubric_item_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_table("rubrics_new")
    op.drop_table("rubric_items_new")

