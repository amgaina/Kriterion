"""Add ASSISTANT role and course_assistants table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-20 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add ASSISTANT to userrole enum (PostgreSQL - must run outside transaction)
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'ASSISTANT'")

    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Create course_assistants table
    if not inspector.has_table('course_assistants'):
        op.create_table(
            'course_assistants',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('course_id', sa.Integer(), nullable=False),
            sa.Column('assistant_id', sa.Integer(), nullable=False),
            sa.Column('assigned_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['assistant_id'], ['users.id'], ),
            sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ),
            sa.PrimaryKeyConstraint('id')
        )

    existing_indexes = {idx['name'] for idx in inspector.get_indexes('course_assistants')}
    if op.f('ix_course_assistants_id') not in existing_indexes:
        op.create_index(op.f('ix_course_assistants_id'), 'course_assistants', ['id'], unique=False)
    if 'ix_course_assistants_course_id' not in existing_indexes:
        op.create_index('ix_course_assistants_course_id', 'course_assistants', ['course_id'], unique=False)
    if 'ix_course_assistants_assistant_id' not in existing_indexes:
        op.create_index('ix_course_assistants_assistant_id', 'course_assistants', ['assistant_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_course_assistants_assistant_id'), table_name='course_assistants')
    op.drop_index('ix_course_assistants_course_id', table_name='course_assistants')
    op.drop_index(op.f('ix_course_assistants_id'), table_name='course_assistants')
    op.drop_table('course_assistants')
    # Note: Removing enum value 'ASSISTANT' from userrole requires more complex migration in PostgreSQL
