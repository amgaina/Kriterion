"""Test case multiple input files (input_files_json)

Revision ID: g8c9d0e1f2a3
Revises: f7b8c9d0e1f2
Create Date: 2026-03-10 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'g8c9d0e1f2a3'
down_revision: Union[str, None] = 'f7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'test_cases',
        sa.Column('input_files_json', sa.JSON(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('test_cases', 'input_files_json')
