"""merge flight operations and baggage persistence

Revision ID: a7c8d9e0f1b2
Revises: a5b6c7d8e9f0, a6b7c8d9e0f1
Create Date: 2026-11-14 23:33:01.613680

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "a7c8d9e0f1b2"
down_revision: tuple[str, str] = ("a5b6c7d8e9f0", "a6b7c8d9e0f1")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
