"""Migrate rubric min/max points to per-item basis.

Revision ID: a1b2c3d4e5f6g7h8
Revises: z9y8x7w6
Create Date: 2026-03-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6g7h8'
down_revision = 'y1x2w3v4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to rubrics table
    op.add_column('rubrics', sa.Column('min_points', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('rubrics', sa.Column('max_points', sa.Float(), nullable=False, server_default='5.0'))
    
    # Remove from assignments table
    op.drop_column('assignments', 'rubric_min_points')
    op.drop_column('assignments', 'rubric_max_points')
    
    # Remove obsolete fields from test_cases
    op.drop_column('test_cases', 'points')
    op.drop_column('test_cases', 'order')
    op.drop_column('test_cases', 'memory_limit_mb')
    op.drop_column('test_cases', 'use_regex')


def downgrade() -> None:
    # Re-add to assignments table
    op.add_column('assignments', sa.Column('rubric_min_points', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('assignments', sa.Column('rubric_max_points', sa.Float(), nullable=False, server_default='10.0'))
    
    # Remove from rubrics table
    op.drop_column('rubrics', 'min_points')
    op.drop_column('rubrics', 'max_points')
    
    # Re-add to test_cases
    op.add_column('test_cases', sa.Column('points', sa.Float(), nullable=False, server_default='10.0'))
    op.add_column('test_cases', sa.Column('order', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('test_cases', sa.Column('memory_limit_mb', sa.Integer(), nullable=True))
    op.add_column('test_cases', sa.Column('use_regex', sa.Boolean(), nullable=False, server_default='false'))
