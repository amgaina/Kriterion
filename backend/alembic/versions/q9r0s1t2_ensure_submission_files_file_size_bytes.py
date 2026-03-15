"""Ensure submission_files.file_size_bytes exists (raw SQL, public schema).

Revision ID: q9r0s1t2
Revises: p8q9r0s1
Create Date: 2026-03-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "q9r0s1t2"
down_revision: Union[str, None] = "p8q9r0s1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add column if missing (handles public schema and any cache/sync issues)
    op.execute(
        sa.text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'submission_files'
                      AND column_name = 'file_size_bytes'
                ) THEN
                    ALTER TABLE public.submission_files
                    ADD COLUMN file_size_bytes INTEGER NOT NULL DEFAULT 0;
                END IF;
            END $$;
        """)
    )


def downgrade() -> None:
    op.execute(sa.text("ALTER TABLE public.submission_files DROP COLUMN IF EXISTS file_size_bytes"))
