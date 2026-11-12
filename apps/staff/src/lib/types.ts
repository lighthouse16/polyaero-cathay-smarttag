export interface BaggageEventItem {
  id: string;
  event_type: string;
  timestamp: string;
  location_code: string;
  station_name: string;
  handled_by_staff_id?: string | null;
  scanner_type: string;
  notes?: string;
}

export interface LiveBag {
  id: string;
  tag_number: string;
  tag_code: string;
  tag_interface?: string;
  booking_reference: string;
  passenger_name: string;
  tier_status: string;
  cabin_class: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  departure_time?: string;
  seat_number: string;
  weight_kg: number;
  connection_minutes?: number;
  status: string;
  is_tag_synced?: boolean;
  last_known_location: string;
  carousel_assigned: string;
  is_rush_bag: boolean;
  risk_score: number;
  risk_level: string;
  risk_factors?: string[];
  passenger_risk_summary?: string;
  predicted_arrival_time?: string;
  model_version?: string;
  recommended_action: string;
  copilot_approval_status?: string;
  passenger_recovery_choice?: string | null;
  recovery_flight_number?: string | null;
  recovery_eta?: string | null;
  delivery_address?: string | null;
  eink_banner: string;
  updated_at: string;
  events: BaggageEventItem[];
}

export type SidebarView =
  "transfer-control" | "exceptions" | "baggage-trace" | "performance";

export type InvestigationTab = "overview" | "journey" | "smarttag" | "history";
