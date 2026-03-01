"""Add start_date and end_date to courses

Revision ID: a1b2c3d4e5f6
Revises: f82c90ffc6a4
Create Date: 2026-02-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f82c90ffc6a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('courses', sa.Column('start_date', sa.DateTime(), nullable=True))
    op.add_column('courses', sa.Column('end_date', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('courses', 'end_date')
    op.drop_column('courses', 'start_date')
