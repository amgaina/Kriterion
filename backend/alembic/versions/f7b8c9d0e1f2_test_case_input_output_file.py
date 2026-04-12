"""Test case input/output as stdin or file (S3)

Revision ID: f7b8c9d0e1f2
Revises: e5f6a7b8c9d0
Create Date: 2026-03-10 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f7b8c9d0e1f2'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('test_cases', sa.Column('input_type', sa.String(20), nullable=False, server_default='stdin'))
    op.add_column('test_cases', sa.Column('input_file_s3_key', sa.String(512), nullable=True))
    op.add_column('test_cases', sa.Column('input_filename', sa.String(255), nullable=True))
    op.add_column('test_cases', sa.Column('expected_output_type', sa.String(20), nullable=False, server_default='text'))
    op.add_column('test_cases', sa.Column('expected_output_file_s3_key', sa.String(512), nullable=True))


def downgrade() -> None:
    op.drop_column('test_cases', 'expected_output_file_s3_key')
    op.drop_column('test_cases', 'expected_output_type')
    op.drop_column('test_cases', 'input_filename')
    op.drop_column('test_cases', 'input_file_s3_key')
    op.drop_column('test_cases', 'input_type')
