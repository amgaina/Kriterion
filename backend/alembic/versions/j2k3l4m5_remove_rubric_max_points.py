"""Remove max_points from rubrics (use weights only).

Revision ID: j2k3l4m5
Revises: h1i2j3k4
Create Date: 2026-03-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "j2k3l4m5"
down_revision: Union[str, None] = "h1i2j3k4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop per-criterion max_points; use weights against assignment.max_score instead."""
    with op.batch_alter_table("rubrics") as batch_op:
        batch_op.drop_column("max_points")


def downgrade() -> None:
    """Re-add max_points column with a sensible default."""
    with op.batch_alter_table("rubrics") as batch_op:
        batch_op.add_column(
            sa.Column("max_points", sa.Float(), nullable=False, server_default="5.0")
        )

