"""trips, itinerary details, and smarttag sync fields

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-11-11 12:40:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e3f4a5b6c7d8"
down_revision: str | None = "d2e3f4a5b6c7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_CABINS = (
    '\'{"ECONOMY": {"seats_available": 18, "price": 320},'
    ' "BUSINESS": {"seats_available": 4, "price": 980}}\'::jsonb'
)


def upgrade() -> None:
    # --- flights become itinerary rows ------------------------------------
    op.add_column("flights", sa.Column("terminal", sa.String(length=10), nullable=True))
    op.add_column("flights", sa.Column("gate", sa.String(length=10), nullable=True))
    op.add_column(
        "flights",
        sa.Column("is_connecting", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "flights", sa.Column("connecting_carrier", sa.String(length=50), nullable=True)
    )
    op.add_column(
        "flights",
        sa.Column(
            "cabins",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )

    op.execute(
        f"""
        UPDATE flights
        SET terminal = COALESCE(terminal, 'T1'),
            gate = COALESCE(gate, '36'),
            cabins = CASE WHEN cabins = '{{}}'::jsonb THEN {DEFAULT_CABINS} ELSE cabins END
        """
    )

    op.execute(
        """
        INSERT INTO flights
            (id, flight_number, origin, destination, departure_time, arrival_time,
             terminal, gate, aircraft, is_connecting, connecting_carrier, cabins)
        VALUES
        ('b0000000-0000-0000-0000-000000000001', 'CX548', 'HKG', 'NRT',
         now() + interval '3 days 10 hours 35 minutes', now() + interval '3 days 16 hours',
         'T1', '36', 'Boeing 777-300ER', false, NULL,
         '{"ECONOMY": {"seats_available": 12, "price": 420}, "PREMIUM_ECONOMY": {"seats_available": 6, "price": 780}, "BUSINESS": {"seats_available": 3, "price": 1450}}'::jsonb),
        ('b0000000-0000-0000-0000-000000000002', 'CX549', 'NRT', 'HKG',
         now() + interval '10 days 17 hours 30 minutes', now() + interval '10 days 21 hours 45 minutes',
         'T2', '12', 'Boeing 777-300ER', false, NULL,
         '{"ECONOMY": {"seats_available": 20, "price": 410}, "BUSINESS": {"seats_available": 5, "price": 1390}}'::jsonb),
        ('b0000000-0000-0000-0000-000000000003', 'CX304', 'HKG', 'NKG',
         now() + interval '2 days 9 hours 15 minutes', now() + interval '2 days 11 hours 45 minutes',
         'T1', '24', 'Airbus A321neo', false, NULL,
         '{"ECONOMY": {"seats_available": 9, "price": 280}, "BUSINESS": {"seats_available": 2, "price": 890}}'::jsonb),
        ('b0000000-0000-0000-0000-000000000004', 'CX332', 'HKG', 'NKG',
         now() + interval '5 days 8 hours 10 minutes', now() + interval '5 days 15 hours 55 minutes',
         'T1', '5', 'Airbus A330-300', true, 'CA1503 (Air China)',
         '{"ECONOMY": {"seats_available": 14, "price": 340}, "BUSINESS": {"seats_available": 4, "price": 1120}}'::jsonb)
        """
    )

    # --- bookings reference an itinerary ----------------------------------
    op.add_column("bookings", sa.Column("flight_id", sa.UUID(), nullable=True))
    op.add_column(
        "bookings",
        sa.Column("checkin_status", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column("bookings", sa.Column("allowed_bags", sa.Integer(), server_default="2", nullable=False))
    op.add_column(
        "bookings", sa.Column("selected_bags", sa.Integer(), server_default="1", nullable=False)
    )

    # Keep legacy booking data by materialising itineraries for it.
    op.execute(
        f"""
        INSERT INTO flights
            (id, flight_number, origin, destination, departure_time, arrival_time,
             terminal, gate, aircraft, is_connecting, connecting_carrier, cabins)
        SELECT gen_random_uuid(), b.flight_number, b.origin, b.destination,
               b.departure_date, b.departure_date + interval '2 hours',
               NULL, NULL, NULL, false, NULL, {DEFAULT_CABINS}
        FROM bookings AS b
        WHERE NOT EXISTS (
            SELECT 1 FROM flights AS f
            WHERE f.flight_number = b.flight_number
              AND f.origin = b.origin
              AND f.destination = b.destination
              AND date(f.departure_time) = date(b.departure_date)
        )
        """
    )
    op.execute(
        """
        UPDATE bookings AS b
        SET flight_id = f.id
        FROM flights AS f
        WHERE b.flight_id IS NULL
          AND f.flight_number = b.flight_number
          AND f.origin = b.origin
          AND f.destination = b.destination
          AND date(f.departure_time) = date(b.departure_date)
        """
    )
    op.alter_column("bookings", "flight_id", existing_type=sa.UUID(), nullable=False)
    op.create_index(op.f("ix_bookings_flight_id"), "bookings", ["flight_id"], unique=False)
    op.create_foreign_key("fk_bookings_flight_id_flights", "bookings", "flights", ["flight_id"], ["id"])

    op.execute("UPDATE bookings SET booking_status = 'UPCOMING' WHERE booking_status = 'CONFIRMED'")
    op.alter_column(
        "bookings",
        "booking_status",
        existing_type=sa.String(length=30),
        server_default="UPCOMING",
        existing_nullable=False,
    )

    op.drop_constraint("bookings_user_id_fkey", "bookings", type_="foreignkey")
    op.create_foreign_key(
        "fk_bookings_user_id_users",
        "bookings",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.alter_column("bookings", "user_id", existing_type=sa.UUID(), nullable=True)

    op.drop_column("bookings", "flight_number")
    op.drop_column("bookings", "origin")
    op.drop_column("bookings", "destination")
    op.drop_column("bookings", "departure_date")
    op.drop_column("bookings", "return_date")
    op.drop_column("bookings", "cabin_class")
    op.drop_column("bookings", "passenger_count")

    # --- smarttag sync state ----------------------------------------------
    op.add_column("tags", sa.Column("booking_id", sa.UUID(), nullable=True))
    op.add_column(
        "tags",
        sa.Column("sync_state", sa.String(length=20), server_default="PREPARE", nullable=False),
    )
    op.add_column("tags", sa.Column("nfc_payload_hash", sa.String(length=64), nullable=True))
    op.add_column("tags", sa.Column("bar_code_payload", sa.String(length=50), nullable=True))
    op.add_column(
        "tags",
        sa.Column("is_simulated", sa.Boolean(), server_default="false", nullable=False),
    )
    op.create_index(op.f("ix_tags_booking_id"), "tags", ["booking_id"], unique=False)
    op.create_foreign_key("fk_tags_booking_id_bookings", "tags", "bookings", ["booking_id"], ["id"])

    op.execute(
        """
        UPDATE tags AS t
        SET booking_id = b.id
        FROM bookings AS b
        WHERE t.pnr = b.pnr
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_tags_booking_id_bookings", "tags", type_="foreignkey")
    op.drop_index(op.f("ix_tags_booking_id"), table_name="tags")
    op.drop_column("tags", "is_simulated")
    op.drop_column("tags", "bar_code_payload")
    op.drop_column("tags", "nfc_payload_hash")
    op.drop_column("tags", "sync_state")
    op.drop_column("tags", "booking_id")

    op.add_column("bookings", sa.Column("flight_number", sa.String(length=10), nullable=True))
    op.add_column("bookings", sa.Column("origin", sa.String(length=3), nullable=True))
    op.add_column("bookings", sa.Column("destination", sa.String(length=3), nullable=True))
    op.add_column("bookings", sa.Column("departure_date", sa.DateTime(timezone=True), nullable=True))
    op.add_column("bookings", sa.Column("return_date", sa.DateTime(timezone=True), nullable=True))
    op.add_column("bookings", sa.Column("cabin_class", sa.String(length=30), nullable=True))
    op.add_column("bookings", sa.Column("passenger_count", sa.Integer(), nullable=True))

    op.execute(
        """
        UPDATE bookings AS b
        SET flight_number = f.flight_number,
            origin = f.origin,
            destination = f.destination,
            departure_date = f.departure_time,
            cabin_class = 'Economy',
            passenger_count = 1
        FROM flights AS f
        WHERE f.id = b.flight_id
        """
    )

    op.alter_column(
        "bookings",
        "booking_status",
        existing_type=sa.String(length=30),
        server_default="CONFIRMED",
        existing_nullable=False,
    )
    op.execute("UPDATE bookings SET booking_status = 'CONFIRMED' WHERE booking_status = 'UPCOMING'")

    op.drop_constraint("fk_bookings_user_id_users", "bookings", type_="foreignkey")
    op.create_foreign_key(
        "bookings_user_id_fkey", "bookings", "users", ["user_id"], ["id"], ondelete="CASCADE"
    )

    op.drop_constraint("fk_bookings_flight_id_flights", "bookings", type_="foreignkey")
    op.drop_index(op.f("ix_bookings_flight_id"), table_name="bookings")
    op.drop_column("bookings", "selected_bags")
    op.drop_column("bookings", "allowed_bags")
    op.drop_column("bookings", "checkin_status")
    op.drop_column("bookings", "flight_id")

    op.drop_column("flights", "cabins")
    op.drop_column("flights", "connecting_carrier")
    op.drop_column("flights", "is_connecting")
    op.drop_column("flights", "gate")
    op.drop_column("flights", "terminal")
