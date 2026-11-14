"""smarttag binding fields

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-11-11 10:05:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d2e3f4a5b6c7"
down_revision: str | None = "c1d2e3f4a5b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("tags", sa.Column("user_id", sa.UUID(), nullable=True))
    op.add_column("tags", sa.Column("pnr", sa.String(length=10), nullable=True))
    op.add_column("tags", sa.Column("baggage_barcode", sa.String(length=50), nullable=True))
    op.add_column(
        "tags",
        sa.Column("tag_status", sa.String(length=30), server_default="UNLINKED", nullable=False),
    )
    op.add_column("tags", sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_tags_user_id_users", "tags", "users", ["user_id"], ["id"], ondelete="SET NULL"
    )
    op.create_foreign_key("fk_tags_pnr_bookings", "tags", "bookings", ["pnr"], ["pnr"])
    op.create_index(op.f("ix_tags_user_id"), "tags", ["user_id"], unique=False)
    op.create_index(op.f("ix_tags_pnr"), "tags", ["pnr"], unique=False)

    # Move the existing binding from bookings.tag_id onto the tag itself.
    op.execute(
        """
        UPDATE tags AS t
        SET pnr = b.pnr,
            user_id = b.user_id,
            tag_status = 'CHECKED_IN',
            last_synced_at = now()
        FROM bookings AS b
        WHERE b.tag_id = t.id
        """
    )

    op.drop_index(op.f("ix_bookings_tag_id"), table_name="bookings")
    op.drop_column("bookings", "tag_id")


def downgrade() -> None:
    op.add_column("bookings", sa.Column("tag_id", sa.UUID(), nullable=True))
    op.create_index(op.f("ix_bookings_tag_id"), "bookings", ["tag_id"], unique=False)
    op.create_foreign_key(
        "fk_bookings_tag_id_tags", "bookings", "tags", ["tag_id"], ["id"]
    )

    op.execute(
        """
        UPDATE bookings AS b
        SET tag_id = t.id
        FROM tags AS t
        WHERE t.pnr = b.pnr
        """
    )

    op.drop_index(op.f("ix_tags_pnr"), table_name="tags")
    op.drop_index(op.f("ix_tags_user_id"), table_name="tags")
    op.drop_constraint("fk_tags_pnr_bookings", "tags", type_="foreignkey")
    op.drop_constraint("fk_tags_user_id_users", "tags", type_="foreignkey")
    op.drop_column("tags", "last_synced_at")
    op.drop_column("tags", "tag_status")
    op.drop_column("tags", "baggage_barcode")
    op.drop_column("tags", "pnr")
    op.drop_column("tags", "user_id")
