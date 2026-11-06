-- PolyAero Cathay SmartTag Initial Schema Migration
-- Production-ready PostgreSQL schema with hardened Row-Level Security (RLS)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Helper function for automated updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. Staff Verification Helper (Reads immutable app_metadata set by Supabase Admin)
CREATE OR REPLACE FUNCTION public.is_ground_staff()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'ground_staff');
END;
$$;

-- 3. Passengers Table
CREATE TABLE IF NOT EXISTS public.passengers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  booking_reference VARCHAR(10) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  membership_number VARCHAR(50),
  tier_status VARCHAR(20) NOT NULL DEFAULT 'GREEN' CHECK (tier_status IN ('GREEN', 'SILVER', 'GOLD', 'DIAMOND')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Flights Table
CREATE TABLE IF NOT EXISTS public.flights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flight_number VARCHAR(10) NOT NULL,
  airline_code VARCHAR(5) NOT NULL DEFAULT 'CX',
  origin VARCHAR(3) NOT NULL,
  origin_city VARCHAR(100) NOT NULL,
  destination VARCHAR(3) NOT NULL,
  destination_city VARCHAR(100) NOT NULL,
  scheduled_departure TIMESTAMPTZ NOT NULL,
  scheduled_arrival TIMESTAMPTZ NOT NULL,
  estimated_departure TIMESTAMPTZ,
  terminal VARCHAR(10),
  gate VARCHAR(10),
  baggage_carousel VARCHAR(20),
  status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_reference VARCHAR(10) NOT NULL,
  passenger_id UUID NOT NULL REFERENCES public.passengers(id) ON DELETE CASCADE,
  flight_id UUID NOT NULL REFERENCES public.flights(id) ON DELETE RESTRICT,
  cabin_class VARCHAR(30) NOT NULL DEFAULT 'ECONOMY',
  seat_number VARCHAR(10),
  ticket_number VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. SmartTags Table (Hardware identity for passive RF / battery-free E-ink tags)
CREATE TABLE IF NOT EXISTS public.smart_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_uid VARCHAR(50) NOT NULL UNIQUE, -- ISO 14443-A UID
  hardware_model VARCHAR(50) NOT NULL DEFAULT 'PolyAero-Passive-2.9in',
  power_source VARCHAR(30) NOT NULL DEFAULT 'PASSIVE_RF' CHECK (power_source IN ('PASSIVE_RF', 'BATTERY_BACKED')),
  battery_level INT CHECK (battery_level IS NULL OR (battery_level >= 0 AND battery_level <= 100)),
  eink_display_status VARCHAR(30) NOT NULL DEFAULT 'UNPROGRAMMED' CHECK (eink_display_status IN ('UNPROGRAMMED', 'UPDATING', 'SYNCHRONIZED', 'WRITE_FAILED')),
  barcode_symbology VARCHAR(30) NOT NULL DEFAULT 'INTERLEAVED_2_OF_5',
  is_write_protected BOOLEAN NOT NULL DEFAULT FALSE,
  last_written_at TIMESTAMPTZ, -- NULL prior to initial hardware write
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Baggage Table
CREATE TABLE IF NOT EXISTS public.baggage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_number VARCHAR(20) NOT NULL UNIQUE, -- IATA 10-digit license plate
  smart_tag_id UUID REFERENCES public.smart_tags(id) ON DELETE SET NULL,
  booking_reference VARCHAR(10) NOT NULL,
  passenger_id UUID NOT NULL REFERENCES public.passengers(id) ON DELETE CASCADE,
  flight_id UUID NOT NULL REFERENCES public.flights(id) ON DELETE RESTRICT,
  weight_kg DECIMAL(5, 2) NOT NULL DEFAULT 20.0,
  current_status VARCHAR(50) NOT NULL DEFAULT 'TAGGED',
  last_known_location VARCHAR(100) NOT NULL DEFAULT 'HKG-APP',
  last_scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  carousel_assigned VARCHAR(50),
  is_rush_bag BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Baggage Events (Audited Milestones)
CREATE TABLE IF NOT EXISTS public.baggage_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baggage_id UUID NOT NULL REFERENCES public.baggage(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location_code VARCHAR(50) NOT NULL,
  station_name VARCHAR(100) NOT NULL,
  handled_by_staff_id VARCHAR(50),
  scanner_type VARCHAR(30) NOT NULL DEFAULT 'NFC_TAP',
  notes TEXT
);

-- 9. Baggage Recovery Cases
CREATE TABLE IF NOT EXISTS public.recovery_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number VARCHAR(30) NOT NULL UNIQUE,
  baggage_id UUID NOT NULL REFERENCES public.baggage(id) ON DELETE CASCADE,
  passenger_id UUID NOT NULL REFERENCES public.passengers(id) ON DELETE CASCADE,
  priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  reported_location VARCHAR(100) NOT NULL,
  current_location VARCHAR(100),
  forwarding_flight_number VARCHAR(20),
  delivery_address TEXT,
  staff_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes on Foreign Keys and Lookups
CREATE INDEX IF NOT EXISTS idx_passengers_auth_user_id ON public.passengers(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id ON public.bookings(passenger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_flight_id ON public.bookings(flight_id);
CREATE INDEX IF NOT EXISTS idx_baggage_passenger_id ON public.baggage(passenger_id);
CREATE INDEX IF NOT EXISTS idx_baggage_flight_id ON public.baggage(flight_id);
CREATE INDEX IF NOT EXISTS idx_baggage_smart_tag_id ON public.baggage(smart_tag_id);
CREATE INDEX IF NOT EXISTS idx_baggage_tag_number ON public.baggage(tag_number);
CREATE INDEX IF NOT EXISTS idx_baggage_events_baggage_id ON public.baggage_events(baggage_id);
CREATE INDEX IF NOT EXISTS idx_recovery_cases_baggage_id ON public.recovery_cases(baggage_id);

-- Attach updated_at Triggers
DROP TRIGGER IF EXISTS trg_baggage_updated_at ON public.baggage;
CREATE TRIGGER trg_baggage_updated_at
  BEFORE UPDATE ON public.baggage
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_recovery_cases_updated_at ON public.recovery_cases;
CREATE TRIGGER trg_recovery_cases_updated_at
  BEFORE UPDATE ON public.recovery_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS across all tables
ALTER TABLE public.passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baggage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baggage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_cases ENABLE ROW LEVEL SECURITY;

-- 1. Flights RLS (Flight schedule visible to all authenticated users)
DROP POLICY IF EXISTS "Authenticated users can view flights" ON public.flights;
CREATE POLICY "Authenticated users can view flights"
  ON public.flights FOR SELECT
  TO authenticated
  USING (true);

-- 2. Passengers RLS
DROP POLICY IF EXISTS "Passengers view own profile" ON public.passengers;
CREATE POLICY "Passengers view own profile"
  ON public.passengers FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_ground_staff());

-- 3. Bookings RLS
DROP POLICY IF EXISTS "Passengers view own bookings" ON public.bookings;
CREATE POLICY "Passengers view own bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.passengers
      WHERE passengers.id = bookings.passenger_id
        AND (passengers.auth_user_id = auth.uid() OR public.is_ground_staff())
    )
  );

-- 4. SmartTags RLS (Restricted visibility: passenger sees only tags linked to their baggage)
DROP POLICY IF EXISTS "SmartTags viewable by authenticated users" ON public.smart_tags;
DROP POLICY IF EXISTS "Staff can manage SmartTags" ON public.smart_tags;
DROP POLICY IF EXISTS "Passengers view own linked smart tags" ON public.smart_tags;

CREATE POLICY "Passengers view own linked smart tags"
  ON public.smart_tags FOR SELECT
  TO authenticated
  USING (
    public.is_ground_staff() OR
    EXISTS (
      SELECT 1 FROM public.baggage
      JOIN public.passengers ON passengers.id = baggage.passenger_id
      WHERE baggage.smart_tag_id = smart_tags.id
        AND passengers.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage SmartTags"
  ON public.smart_tags FOR ALL
  TO authenticated
  USING (public.is_ground_staff())
  WITH CHECK (public.is_ground_staff());

-- 5. Baggage RLS
DROP POLICY IF EXISTS "Passengers view own baggage" ON public.baggage;
DROP POLICY IF EXISTS "Staff can view and update all baggage" ON public.baggage;
DROP POLICY IF EXISTS "Staff can manage all baggage" ON public.baggage;

CREATE POLICY "Passengers view own baggage"
  ON public.baggage FOR SELECT
  TO authenticated
  USING (
    public.is_ground_staff() OR
    EXISTS (
      SELECT 1 FROM public.passengers
      WHERE passengers.id = baggage.passenger_id
        AND passengers.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage all baggage"
  ON public.baggage FOR ALL
  TO authenticated
  USING (public.is_ground_staff())
  WITH CHECK (public.is_ground_staff());

-- 6. Baggage Events RLS
DROP POLICY IF EXISTS "Passengers view own baggage events" ON public.baggage_events;
DROP POLICY IF EXISTS "Staff can insert baggage events" ON public.baggage_events;

CREATE POLICY "Passengers view own baggage events"
  ON public.baggage_events FOR SELECT
  TO authenticated
  USING (
    public.is_ground_staff() OR
    EXISTS (
      SELECT 1 FROM public.baggage
      JOIN public.passengers ON passengers.id = baggage.passenger_id
      WHERE baggage.id = baggage_events.baggage_id
        AND passengers.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can insert baggage events"
  ON public.baggage_events FOR INSERT
  TO authenticated
  WITH CHECK (public.is_ground_staff());

-- 7. Recovery Cases RLS (Strict ground staff operations only)
DROP POLICY IF EXISTS "Staff can manage recovery cases" ON public.recovery_cases;

CREATE POLICY "Staff can manage recovery cases"
  ON public.recovery_cases FOR ALL
  TO authenticated
  USING (public.is_ground_staff())
  WITH CHECK (public.is_ground_staff());
