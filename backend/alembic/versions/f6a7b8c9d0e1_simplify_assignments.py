"""Simplify assignments: drop difficulty, required_files, test_weight, rubric_weight

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop columns from assignments (manual rubric only; no difficulty/test_weight/rubric_weight/required_files)
    op.drop_column('assignments', 'test_weight')
    op.drop_column('assignments', 'rubric_weight')
    op.drop_column('assignments', 'required_files')
    op.drop_column('assignments', 'difficulty')
    op.execute('DROP TYPE IF EXISTS difficultylevel')


def downgrade() -> None:
    op.execute("CREATE TYPE difficultylevel AS ENUM ('EASY', 'MEDIUM', 'HARD')")
    op.add_column('assignments', sa.Column('difficulty', sa.Enum('EASY', 'MEDIUM', 'HARD', name='difficultylevel'), nullable=True))
    op.add_column('assignments', sa.Column('required_files', sa.JSON(), nullable=True))
    op.add_column('assignments', sa.Column('test_weight', sa.Float(), nullable=True))
    op.add_column('assignments', sa.Column('rubric_weight', sa.Float(), nullable=True))
