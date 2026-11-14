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

export interface OutboundFlightSummary {
  leg: FlightLeg;
  transferBagCount: number;
  actionRequiredCount: number;
  atRiskCount: number;
  onTrackCount: number;
  unknownCount: number;
  earliestActionAt: string | null;
  riskScore: number | null;
}

export type InboundConnectionSummary = OutboundFlightSummary;

export interface TransferMetrics {
  total: number | null;
  actionRequired: number | null;
  atRisk: number | null;
  onTrack: number | null;
  unknown: number | null;
  success: number | null;
}

export type PerformanceWindow = "24h" | "7d" | "30d";

export type RecoveryStageKey =
  | "detected"
  | "actioned"
  | "located"
  | "loaded"
  | "transferred";

export type RiskCauseAttributionMode =
  | "primary_exclusive"
  | "multi_factor_mentions"
  | "unavailable";

export interface MetricComparison {
  delta: number;
  unit: "percent" | "pp" | "count" | "minutes";
  direction: "up" | "down" | "flat";
  polarity: "positive_good" | "negative_good" | "neutral";
  baselineLabel: string;
  provenance: OperationalProvenance;
}

/** Single transfer-bag recovery case, keyed so repeat scans never inflate counts. */
export interface RecoveryEpisodeRecord {
  episodeId: string;
  bagTag: string;
  connectionId: string;
  inboundLegId: string;
  outboundLegId: string;
  outboundFlightNumber: string;
  outboundOperatingDate: string;
  origin: string;
  destination: string;
  station: string;
  detectedAt: string;
  actionedAt: string | null;
  locatedAt: string | null;
  loadedAt: string | null;
  transferredAt: string | null;
  loadingCutoffAt: string | null;
  outcome: "recovered" | "missed" | "pending" | "unknown";
  primaryRiskCause: string | null;
  riskFactors: string[];
  provenance: OperationalProvenance;
}

export interface EligibleTransferRecord {
  bagTag: string;
  connectionId: string;
  outboundLegId: string;
  outboundFlightNumber: string;
  outboundOperatingDate: string;
  origin: string;
  destination: string;
  station: string;
  observedAt: string;
  transferred: boolean | null;
  provenance: OperationalProvenance;
}

export interface CounterfactualAssumptions {
  counterfactualModelVersion: string;
  missedConnectionBaselineRate: number;
  methodologyNote: string;
  provenance: OperationalProvenance;
}

export interface LaborAssumptions {
  minutesSavedPerHandledCase: number;
  methodologyNote: string;
  provenance: OperationalProvenance;
}

export interface CostAssumptions {
  currency: string;
  costPerAvoidedMisconnection: number;
  methodologyNote: string;
  provenance: OperationalProvenance;
}

export interface PerformanceFilterState {
  window: PerformanceWindow;
  station: string;
  outboundLegId: string;
}

export interface PerformanceKpiMetric {
  id: "highRisk" | "actioned" | "recoveredBeforeCutoff" | "transferSuccess";
  label: string;
  value: number | null;
  unit: "count" | "percent";
  decimals?: number;
  numerator: number | null;
  denominator: number | null;
  definition: string;
  exclusionNote: string | null;
  availabilityNote: string | null;
  comparison: MetricComparison | null;
}

export interface RecoveryFunnelStage {
  key: RecoveryStageKey;
  label: string;
  count: number | null;
  stepConversionPct: number | null;
  cumulativePct: number | null;
  definition: string;
  availabilityNote: string | null;
}

export interface RecoveryTrendBucket {
  bucketKey: string;
  label: string;
  rangeLabel: string;
  detectedCount: number | null;
  recoveredCount: number | null;
  eligibleTransferCount: number | null;
  successfulTransferCount: number | null;
  successRatePct: number | null;
}

export interface OutboundFlightImpactRow {
  legKey: string;
  outboundLegId: string;
  flightNumber: string;
  operatingDate: string;
  route: string;
  transferBags: number | null;
  highRiskBags: number | null;
  recoveredBeforeCutoff: number | null;
  missedBags: number | null;
  pendingBags: number | null;
  saveRatePct: number | null;
  inActiveSnapshot: boolean;
}

export interface RiskCauseSlice {
  category: string;
  count: number;
  sharePct: number | null;
}

export interface RiskCauseBreakdownSummary {
  mode: RiskCauseAttributionMode;
  totalCases: number | null;
  items: RiskCauseSlice[];
  availabilityNote: string | null;
}

export interface OperationalEfficiencySummary {
  medianAlertToActionMin: number | null;
  alertToActionSampleSize: number;
  medianActionToLocateMin: number | null;
  actionToLocateSampleSize: number;
  resolvedBeforeCutoffCount: number | null;
  resolvedBeforeCutoffPct: number | null;
  resolvedBeforeCutoffDenominator: number | null;
  pendingExcludedCount: number;
  availabilityNote: string | null;
}

export interface BusinessImpactItem {
  id: "avoidedMisconnections" | "staffHoursSaved" | "costAvoided";
  label: string;
  kind: "observed" | "estimated";
  value: number | null;
  currency?: string;
  unit: "count" | "hours" | "currency";
  decimals?: number;
  assumptionNote: string | null;
  availabilityNote: string | null;
  comparison: MetricComparison | null;
}

export interface OutboundFlightOption {
  legKey: string;
  outboundLegId: string;
  flightNumber: string;
  operatingDate: string;
  route: string;
}

export interface RecoveryPerformanceReport {
  availability: "available" | "partial" | "unavailable";
  source: string;
  generatedAt: string;
  validUntil: string | null;
  window: PerformanceWindow;
  windowStart: string | null;
  windowEnd: string | null;
  station: string;
  supportedWindows: PerformanceWindow[];
  supportedStations: string[];
  outboundFilterOptions: OutboundFlightOption[];
  missingInputs: string[];
  statusNote: string | null;
  kpis: PerformanceKpiMetric[];
  funnel: RecoveryFunnelStage[];
  funnelNote: string | null;
  trend: RecoveryTrendBucket[];
  trendNote: string | null;
  outboundImpact: OutboundFlightImpactRow[];
  outboundImpactDefinition: string;
  riskCauses: RiskCauseBreakdownSummary;
  efficiency: OperationalEfficiencySummary;
  businessImpact: BusinessImpactItem[];
}
