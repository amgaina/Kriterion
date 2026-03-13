"""add file_size_bytes to submission_files

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-03-13 19:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE submission_files ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER")
    op.execute("UPDATE submission_files SET file_size_bytes = 0 WHERE file_size_bytes IS NULL")
    op.alter_column('submission_files', 'file_size_bytes', existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    op.execute("ALTER TABLE submission_files DROP COLUMN IF EXISTS file_size_bytes")
