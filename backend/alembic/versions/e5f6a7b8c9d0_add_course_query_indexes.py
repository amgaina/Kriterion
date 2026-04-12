"""Add indexes for course loading performance

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-10 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    course_indexes = {idx['name'] for idx in inspector.get_indexes('courses')}
    if 'ix_courses_instructor_id' not in course_indexes:
        op.create_index('ix_courses_instructor_id', 'courses', ['instructor_id'], unique=False)

    assignment_indexes = {idx['name'] for idx in inspector.get_indexes('assignments')}
    if 'ix_assignments_course_id' not in assignment_indexes:
        op.create_index('ix_assignments_course_id', 'assignments', ['course_id'], unique=False)

    enrollment_indexes = {idx['name'] for idx in inspector.get_indexes('enrollments')}
    if 'ix_enrollments_course_id_status' not in enrollment_indexes:
        op.create_index('ix_enrollments_course_id_status', 'enrollments', ['course_id', 'status'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    course_indexes = {idx['name'] for idx in inspector.get_indexes('courses')}
    if 'ix_courses_instructor_id' in course_indexes:
        op.drop_index('ix_courses_instructor_id', table_name='courses')

    assignment_indexes = {idx['name'] for idx in inspector.get_indexes('assignments')}
    if 'ix_assignments_course_id' in assignment_indexes:
        op.drop_index('ix_assignments_course_id', table_name='assignments')

    enrollment_indexes = {idx['name'] for idx in inspector.get_indexes('enrollments')}
    if 'ix_enrollments_course_id_status' in enrollment_indexes:
        op.drop_index('ix_enrollments_course_id_status', table_name='enrollments')
