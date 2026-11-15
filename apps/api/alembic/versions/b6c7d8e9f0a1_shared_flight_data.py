"""Centralize flight risk inputs and link baggage to the canonical flight."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "b6c7d8e9f0a1"
down_revision = "a7c8d9e0f1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for name, column_type, default in (
        ("weather_severity", sa.Integer(), "2"),
        ("load_factor_pct", sa.Float(), "86"),
        ("airport_congestion", sa.Integer(), "2"),
        ("initial_status", sa.String(30), "AWAITING_SYNC"),
    ):
        op.add_column(
            "flights", sa.Column(name, column_type, nullable=False, server_default=default)
        )
    for name, expression in (
        ("ck_flights_weather", "weather_severity BETWEEN 1 AND 5"),
        ("ck_flights_load", "load_factor_pct BETWEEN 0 AND 100"),
        ("ck_flights_congestion", "airport_congestion BETWEEN 1 AND 5"),
        ("ck_flights_initial_status", "initial_status IN ('AWAITING_SYNC', 'CHECKED_IN')"),
    ):
        op.create_check_constraint(name, "flights", expression)
    op.add_column("baggage", sa.Column("flight_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(
        "baggage",
        sa.Column("connection_minutes", sa.Integer(), nullable=False, server_default="85"),
    )
    op.create_check_constraint(
        "ck_baggage_connection_minutes", "baggage", "connection_minutes >= 0"
    )
    op.execute("""
        UPDATE baggage AS bag SET flight_id = booking.flight_id
        FROM tags AS tag JOIN bookings AS booking ON booking.id = tag.booking_id
        JOIN flights AS flight ON flight.id = booking.flight_id
        WHERE bag.tag_id = tag.id
          AND bag.flight_number = flight.flight_number
          AND bag.departure_airport = flight.origin
          AND bag.arrival_airport = flight.destination
          AND bag.departure_time = flight.departure_time
    """)
    op.execute("""
        UPDATE baggage AS bag SET flight_id = match.id
        FROM (
            SELECT flight_number, origin, destination, departure_time,
                   min(id::text)::uuid AS id
            FROM flights GROUP BY flight_number, origin, destination, departure_time
            HAVING count(*) = 1
        ) AS match
        WHERE bag.flight_id IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM tags AS tag JOIN bookings AS booking ON booking.id = tag.booking_id
              WHERE tag.id = bag.tag_id
          )
          AND bag.flight_number = match.flight_number
          AND bag.departure_airport = match.origin
          AND bag.arrival_airport = match.destination
          AND bag.departure_time = match.departure_time
    """)
    unresolved = op.get_bind().scalar(
        sa.text("SELECT count(*) FROM baggage WHERE flight_id IS NULL")
    )
    if unresolved:
        raise RuntimeError(
            f"Cannot link {unresolved} baggage rows to an unambiguous flight. "
            "Correct their flight number/route/departure time or conflicting tag booking before migrating."
        )
    op.alter_column("baggage", "flight_id", nullable=False)
    op.create_foreign_key(
        "fk_baggage_flight_id_flights",
        "baggage",
        "flights",
        ["flight_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_baggage_flight_id", "baggage", ["flight_id"])
    op.drop_index("ix_baggage_flight_number", table_name="baggage")
    for name in ("flight_number", "departure_airport", "arrival_airport", "departure_time"):
        op.drop_column("baggage", name)


def downgrade() -> None:
    for name, column_type in (
        ("flight_number", sa.String(20)),
        ("departure_airport", sa.String(3)),
        ("arrival_airport", sa.String(3)),
        ("departure_time", sa.DateTime(timezone=True)),
    ):
        op.add_column("baggage", sa.Column(name, column_type, nullable=True))
    op.execute("""
        UPDATE baggage AS bag
        SET flight_number = flight.flight_number,
            departure_airport = flight.origin,
            arrival_airport = flight.destination,
            departure_time = flight.departure_time
        FROM flights AS flight WHERE flight.id = bag.flight_id
    """)
    for name in ("flight_number", "departure_airport", "arrival_airport", "departure_time"):
        op.alter_column("baggage", name, nullable=False)
    op.create_index("ix_baggage_flight_number", "baggage", ["flight_number"])
    op.drop_index("ix_baggage_flight_id", table_name="baggage")
    op.drop_constraint("fk_baggage_flight_id_flights", "baggage", type_="foreignkey")
    op.drop_column("baggage", "flight_id")
    op.drop_constraint("ck_baggage_connection_minutes", "baggage", type_="check")
    op.drop_column("baggage", "connection_minutes")
    for name in (
        "ck_flights_weather",
        "ck_flights_load",
        "ck_flights_congestion",
        "ck_flights_initial_status",
    ):
        op.drop_constraint(name, "flights", type_="check")
    for name in ("weather_severity", "load_factor_pct", "airport_congestion", "initial_status"):
        op.drop_column("flights", name)
