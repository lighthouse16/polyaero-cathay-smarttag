export interface BaggageEventItem {
  id: string;
  event_type: string;
  timestamp: string;
  location_code: string;
  station_name: string;
  handled_by_staff_id?: string | null;
  scanner_type: string;
  notes?: string;
  provenance?: OperationalProvenance;
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

/** Source validity must come from upstream, never a locally invented TTL. */
export interface OperationalProvenance {
  system: string;
  recordId: string;
  observedAt: string;
  validUntil: string;
}

export interface FlightLeg {
  id: string;
  flightNumber: string;
  operatingDate: string;
  origin: string;
  destination: string;
  scheduledDepartureAt: string | null;
  scheduledArrivalAt: string | null;
  estimatedDepartureAt: string | null;
  estimatedArrivalAt: string | null;
  actualArrivalAt: string | null;
  provenance: OperationalProvenance;
}

export interface HandlingDeadline {
  at: string;
  kind: "latest_intervention";
  provenance: OperationalProvenance;
}

export type TransferAttention = "action_required" | "at_risk" | "on_track" | "unknown";

export interface BagTransferConnection {
  id: string;
  bagTag: string;
  inboundLegId: string;
  outboundLegId: string;
  status: "pending" | "transferred" | "missed";
  attention: TransferAttention;
  deadline: HandlingDeadline | null;
  provenance: OperationalProvenance;
}

export interface FlightRiskAssessment {
  flightLegId: string;
  status: "assessed" | "unavailable";
  score: number | null;
  modelVersion: string | null;
  assessedAt: string | null;
  validUntil: string | null;
  evidence: OperationalProvenance[];
  missingInputs: string[];
}

export interface BagRiskAssessment {
  bagTag: string;
  status: "assessed" | "unavailable";
  score: number | null;
  modelVersion: string | null;
  assessedAt: string | null;
  validUntil: string | null;
  evidence: OperationalProvenance[];
  missingInputs: string[];
}

export interface TransferControlSnapshot {
  availability: "available" | "unavailable";
  generatedAt: string;
  validUntil: string | null;
  source: string;
  missingInputs: string[];
  bags: LiveBag[];
  legs: FlightLeg[];
  connections: BagTransferConnection[];
  flightRisks: FlightRiskAssessment[];
  bagRisks: BagRiskAssessment[];
  transferSuccess: null | {
    successful: number;
    eligible: number;
    windowStart: string;
    windowEnd: string;
    provenance: OperationalProvenance;
  };
}

export interface InboundFlightSummary {
  leg: FlightLeg;
  transferBagCount: number;
  actionRequiredCount: number;
  atRiskCount: number;
  onTrackCount: number;
  unknownCount: number;
  earliestActionAt: string | null;
  riskScore: number | null;
}

export type OutboundConnectionSummary = InboundFlightSummary;

export interface TransferMetrics {
  total: number | null;
  actionRequired: number | null;
  atRisk: number | null;
  onTrack: number | null;
  unknown: number | null;
  success: number | null;
}
