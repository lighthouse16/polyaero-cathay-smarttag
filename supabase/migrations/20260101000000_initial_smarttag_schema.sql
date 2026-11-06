-- PolyAero Cathay SmartTag Initial Schema Migration
-- Hackathon 2026 Prototype Data Layer

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Passengers Table
CREATE TABLE IF NOT EXISTS public.passengers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_reference VARCHAR(10) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  membership_number VARCHAR(50),
  tier_status VARCHAR(20) NOT NULL DEFAULT 'GREEN' CHECK (tier_status IN ('GREEN', 'SILVER', 'GOLD', 'DIAMOND')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Flights Table
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

-- 3. Bookings Table
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

-- 4. SmartTags (Physical E-ink hardware identity)
CREATE TABLE IF NOT EXISTS public.smart_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_uid VARCHAR(50) NOT NULL UNIQUE,
  hardware_version VARCHAR(50) NOT NULL DEFAULT 'E-INK-2.9-V2',
  firmware_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  battery_level INT NOT NULL DEFAULT 100 CHECK (battery_level >= 0 AND battery_level <= 100),
  eink_display_status VARCHAR(30) NOT NULL DEFAULT 'READY',
  is_nfc_locked BOOLEAN NOT NULL DEFAULT FALSE,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Baggage Table
CREATE TABLE IF NOT EXISTS public.baggage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_number VARCHAR(20) NOT NULL UNIQUE, -- IATA 10-digit barcode string
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

-- 6. Baggage Events (Audit Trail & Milestone Tracking)
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

-- 7. Baggage Recovery Cases
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

-- Realtime Publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.baggage;
ALTER PUBLICATION supabase_realtime ADD TABLE public.baggage_events;

-- Row Level Security (RLS) Setup
ALTER TABLE public.passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baggage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baggage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_cases ENABLE ROW LEVEL SECURITY;

-- Passenger Read Policy (Users can only see their own baggage records)
CREATE POLICY "Passengers can read own profile"
  ON public.passengers
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Passengers can view own baggage"
  ON public.baggage
  FOR SELECT
  USING (auth.uid() = passenger_id);

-- Staff Role Policy (Ground staff can view and update all baggage records)
CREATE POLICY "Staff can view and update all baggage"
  ON public.baggage
  FOR ALL
  USING (coalesce(auth.jwt()->>'role', '') = 'ground_staff');

CREATE POLICY "Staff can manage recovery cases"
  ON public.recovery_cases
  FOR ALL
  USING (coalesce(auth.jwt()->>'role', '') = 'ground_staff');
