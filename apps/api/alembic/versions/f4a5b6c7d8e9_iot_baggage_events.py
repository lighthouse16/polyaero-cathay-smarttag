"""iot nfc baggage events

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-11-12 18:10:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f4a5b6c7d8e9"
down_revision: str | None = "e3f4a5b6c7d8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "bookings",
        sa.Column("cabin_class", sa.String(length=20), server_default="ECONOMY", nullable=False),
    )
    op.add_column("tags", sa.Column("weight_kg", sa.Float(), nullable=True))

    op.create_table(
        "baggage_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("tag_id", sa.UUID(), nullable=False),
        sa.Column("booking_id", sa.UUID(), nullable=True),
        sa.Column("event_type", sa.String(length=30), nullable=False),
        sa.Column("location_code", sa.String(length=50), nullable=True),
        sa.Column("station_name", sa.String(length=100), nullable=True),
        sa.Column("reader_id", sa.String(length=50), nullable=True),
        sa.Column("scanner_type", sa.String(length=30), server_default="NFC_TAP", nullable=False),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_baggage_events_tag_id"), "baggage_events", ["tag_id"], unique=False)
    op.create_index(
        op.f("ix_baggage_events_booking_id"), "baggage_events", ["booking_id"], unique=False
    )
    op.create_index(
        "ix_baggage_events_tag_created", "baggage_events", ["tag_id", "created_at"], unique=False
    )

    op.execute(
        "UPDATE tags SET tag_status = 'CHECKED_IN' "
        "WHERE booking_id IS NOT NULL AND tag_status = 'UNLINKED'"
    )


def downgrade() -> None:
    op.drop_index("ix_baggage_events_tag_created", table_name="baggage_events")
    op.drop_index(op.f("ix_baggage_events_booking_id"), table_name="baggage_events")
    op.drop_index(op.f("ix_baggage_events_tag_id"), table_name="baggage_events")
    op.drop_table("baggage_events")
    op.drop_column("tags", "weight_kg")
    op.drop_column("bookings", "cabin_class")
