'use client';

import React, { useEffect, useState, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const STAFF_ID = 'STF-8821';
const STATION = 'HKG-T1 Ramp Operations';

interface BaggageEventItem {
  id: string;
  event_type: string;
  timestamp: string;
  location_code: string;
  station_name: string;
  handled_by_staff_id?: string;
  scanner_type: string;
  notes?: string;
}

interface LiveBag {
  id: string;
  tag_number: string;
  tag_code: string;
  booking_reference: string;
  passenger_name: string;
  tier_status: string;
  cabin_class: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  seat_number: string;
  weight_kg: number;
  status: string;
  last_known_location: string;
  carousel_assigned: string;
  is_rush_bag: boolean;
  risk_score: number;
  risk_level: string;
  conveyor_action: string;
  eink_banner: string;
  updated_at: string;
  events: BaggageEventItem[];
}

interface RiskPrediction {
  risk_score: number;
  risk_level: string;
  priority_sequence: number;
  conveyor_action: string;
  passenger_alert: string | null;
  factors: string[];
}

const OVERRIDE_STATUSES = [
  'TAGGED',
  'CHECKED_IN',
  'SECURITY_CLEARED',
  'LOADED',
  'IN_FLIGHT',
  'ON_CAROUSEL',
  'CLAIMED',
  'MISROUTED',
  'MISSING',
];

function formatTime(iso: string): string {
  try {
    return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  } catch {
    return iso;
  }
}

export default function StaffDashboardPage() {
  const [bags, setBags] = useState<LiveBag[]>([]);
  const [selectedTagNum, setSelectedTagNum] = useState<string>('0160892012');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  const [transferMins, setTransferMins] = useState<number>(38);
  const [weatherSeverity, setWeatherSeverity] = useState<number>(4);
  const [loadFactor, setLoadFactor] = useState<number>(92);
  const [congestion, setCongestion] = useState<number>(4);
  const [riskResult, setRiskResult] = useState<RiskPrediction | null>(null);

  const fetchBags = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/baggage`, { cache: 'no-store' });
      if (!res.ok) throw new Error('API unavailable');
      const data: LiveBag[] = await res.json();
      setBags(data);
      setIsLiveConnected(true);
    } catch {
      setIsLiveConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchBags();
    const interval = setInterval(fetchBags, 3000);
    return () => clearInterval(interval);
  }, [fetchBags]);

  const selectedBag = bags.find((b) => b.tag_number === selectedTagNum) || bags[0] || null;
  const conveyorQueue = [...bags].sort((a, b) => b.risk_score - a.risk_score);

  const handleResetDemo = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/baggage/reset`, { method: 'POST' });
      if (res.ok) {
        const fresh: LiveBag[] = await res.json();
        setBags(fresh);
        setRiskResult(null);
        setActionBanner('Demo State Reset: All SmartTags restored to clean baseline for stage rehearsal.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedBag) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/baggage/${selectedBag.tag_number}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: newStatus,
          location_code: 'HKG-T1-RAMP-04',
          station_name: STATION,
          scanner_type: 'NFC_TAP',
          staff_id: STAFF_ID,
          notes: `Ground staff updated status to ${newStatus} & queued E-ink refresh`,
        }),
      });
      if (res.ok) {
        const updated: LiveBag = await res.json();
        setBags((prev) => prev.map((b) => (b.tag_number === updated.tag_number ? updated : b)));
        setActionBanner(`Synced ${updated.tag_number} → ${newStatus} (E-Ink Banner: ${updated.eink_banner})`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleHandheldNfcRecover = async () => {
    if (!selectedBag) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/baggage/${selectedBag.tag_number}/recover`, { method: 'POST' });
      if (res.ok) {
        const updated: LiveBag = await res.json();
        setBags((prev) => prev.map((b) => (b.tag_number === updated.tag_number ? updated : b)));
        setActionBanner(
          `HANDHELD NFC TAP VERIFIED: Owner ${updated.passenger_name} confirmed • Bag loaded onto ${updated.flight_number}`
        );
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTriggerIrrops = async () => {
    if (!selectedBag) return;
    setIsSyncing(true);
    const nextFlight = selectedBag.flight_number === 'CX888' ? 'CX890' : 'CX257';
    try {
      const res = await fetch(`${API_BASE}/baggage/${selectedBag.tag_number}/irrops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_flight_number: nextFlight,
          reason: 'Automated IRROPS rebooking — Express Transfer & E-Ink Reroute',
        }),
      });
      if (res.ok) {
        const updated: LiveBag = await res.json();
        setBags((prev) => prev.map((b) => (b.tag_number === updated.tag_number ? updated : b)));
        setActionBanner(
          `IRROPS REROUTE PUSHED: ${updated.tag_number} reassigned to ${nextFlight} • E-Ink now displays "${updated.eink_banner}"`
        );
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRunRiskPrediction = async () => {
    if (!selectedBag) return;
    try {
      const res = await fetch(`${API_BASE}/baggage/${selectedBag.tag_number}/risk/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flight_number: selectedBag.flight_number,
          origin: selectedBag.departure_airport,
          destination: selectedBag.arrival_airport,
          transfer_minutes: transferMins,
          weather_severity: weatherSeverity,
          load_factor_pct: loadFactor,
          airport_congestion: congestion,
        }),
      });
      if (res.ok) {
        const result: RiskPrediction = await res.json();
        setRiskResult(result);
        await fetchBags();
        setActionBanner(
          `AI Risk Applied to ${selectedBag.tag_number}: Score ${result.risk_score}/100 (${result.conveyor_action})`
        );
      }
    } catch {
      // Ignore if offline
    }
  };

  const totalTracked = bags.length;
  const loadedCount = bags.filter((b) => b.status === 'LOADED').length;
  const atRiskCount = bags.filter((b) => b.status === 'MISROUTED' || b.status === 'MISSING' || b.is_rush_bag).length;

  const filteredBaggage = bags.filter((bag) => {
    const term = searchTerm.toLowerCase();
    return (
      bag.tag_number.toLowerCase().includes(term) ||
      bag.booking_reference.toLowerCase().includes(term) ||
      bag.passenger_name.toLowerCase().includes(term) ||
      bag.flight_number.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F8FAFC' }}>
      <header
        style={{
          backgroundColor: '#006564',
          color: '#FFFFFF',
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              backgroundColor: '#C49A45',
              color: '#0B2545',
              padding: '4px 10px',
              borderRadius: '4px',
              fontWeight: 700,
              fontSize: '12px',
            }}
          >
            POLYAERO
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Cathay SmartTag Ground Staff Operations</h1>
            <p style={{ fontSize: '12px', opacity: 0.85 }}>
              Station: HKG (Hong Kong International Airport) • Terminal 1 Ramp & Baggage Intelligence
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleResetDemo}
            disabled={isSyncing}
            style={{
              backgroundColor: '#FFFFFF',
              color: '#006564',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ↺ Reset Demo State
          </button>
          <span
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              padding: '6px 12px',
              borderRadius: '16px',
              fontSize: '12px',
            }}
          >
            Operator: {STAFF_ID}
          </span>
          <span
            style={{
              backgroundColor: isLiveConnected ? '#E3FCEF' : '#FFEBE6',
              color: isLiveConnected ? '#006644' : '#BF2600',
              border: `1px solid ${isLiveConnected ? '#00875A' : '#DE350B'}`,
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            {isLiveConnected ? '● LIVE API + ESP32 SYNC' : '○ API DISCONNECTED (START PORT 8000)'}
          </span>
        </div>
      </header>

      <main style={{ flex: 1, padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        {actionBanner && (
          <div
            style={{
              backgroundColor: '#E3FCEF',
              border: '1px solid #00875A',
              color: '#004B32',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>✓ {actionBanner}</span>
            <button
              onClick={() => setActionBanner(null)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* KPI Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>ACTIVE SMARTTAGS</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#006564', marginTop: '4px' }}>{totalTracked}</div>
            <div style={{ fontSize: '11px', color: '#00875A', marginTop: '4px' }}>Connected to E-Ink Cloud</div>
          </div>
          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>LOADED / MANIFESTED</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
              {loadedCount} / {totalTracked}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>ULD container verified</div>
          </div>
          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>PRIORITY / IRROPS REROUTES</div>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 700,
                color: atRiskCount > 0 ? '#DE350B' : '#00875A',
                marginTop: '4px',
              }}
            >
              {atRiskCount}
            </div>
            <div style={{ fontSize: '11px', color: atRiskCount > 0 ? '#DE350B' : '#00875A', marginTop: '4px' }}>
              Auto-diverted on BHS conveyor
            </div>
          </div>
          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>PAPER TAGS SAVED</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#C49A45', marginTop: '4px' }}>100%</div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Zero kiosk thermal waste</div>
          </div>
        </div>

        {/* Main 2-Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Live Registry */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Live SmartTag Baggage Registry</h2>
                <input
                  type="text"
                  placeholder="Search Tag, PNR, Passenger, Flight..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    minWidth: '250px',
                  }}
                />
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                    <th style={{ padding: '10px 8px' }}>Tag Number</th>
                    <th style={{ padding: '10px 8px' }}>Passenger</th>
                    <th style={{ padding: '10px 8px' }}>Flight</th>
                    <th style={{ padding: '10px 8px' }}>Status</th>
                    <th style={{ padding: '10px 8px' }}>E-Ink Banner</th>
                    <th style={{ padding: '10px 8px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBaggage.map((bag) => (
                    <tr
                      key={bag.tag_number}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: selectedBag?.tag_number === bag.tag_number ? '#F0F9F9' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 8px', fontWeight: 700 }}>{bag.tag_number}</td>
                      <td style={{ padding: '12px 8px' }}>
                        {bag.passenger_name}{' '}
                        <span style={{ fontSize: '11px', color: '#006564', fontWeight: 600 }}>({bag.tier_status})</span>
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                        {bag.flight_number} ({bag.departure_airport}→{bag.arrival_airport})
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor:
                              bag.status === 'LOADED'
                                ? '#E3FCEF'
                                : bag.status === 'MISROUTED' || bag.status === 'MISSING'
                                ? '#FFEBE6'
                                : '#E6F0F0',
                            color:
                              bag.status === 'LOADED'
                                ? '#00875A'
                                : bag.status === 'MISROUTED' || bag.status === 'MISSING'
                                ? '#DE350B'
                                : '#006564',
                          }}
                        >
                          {bag.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontSize: '11px', fontWeight: 700 }}>
                        {bag.eink_banner}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <button
                          onClick={() => setSelectedTagNum(bag.tag_number)}
                          style={{
                            backgroundColor: '#006564',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '5px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Automated Conveyor Priority Queue */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
                Automated BHS Conveyor Priority Queue
              </h2>
              <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>
                Real-time transfer sequence generated by the AI Mishandling Risk Engine
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {conveyorQueue.map((bag, idx) => (
                  <div
                    key={bag.tag_number}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderRadius: '6px',
                      backgroundColor: bag.risk_score >= 65 ? '#FFF5F5' : '#F8FAFC',
                      border: `1px solid ${bag.risk_score >= 65 ? '#FEB2B2' : '#E2E8F0'}`,
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 800, marginRight: '10px', color: '#0B2545' }}>#{idx + 1}</span>
                      <span style={{ fontWeight: 700 }}>{bag.tag_number}</span> • {bag.passenger_name} (
                      {bag.flight_number})
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                      <span style={{ fontWeight: 700, color: bag.risk_score >= 65 ? '#DE350B' : '#006564' }}>
                        Risk: {bag.risk_score}/100
                      </span>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: bag.risk_score >= 65 ? '#DE350B' : '#006564',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: '11px',
                        }}
                      >
                        {bag.conveyor_action}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Risk Simulator */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 600 }}>AI Mishandling Risk & Conveyor Simulator</h2>
                  <p style={{ fontSize: '12px', color: '#64748B' }}>
                    Applies risk prediction directly to selected bag ({selectedBag?.tag_number || '0160892012'})
                  </p>
                </div>
                <button
                  onClick={handleRunRiskPrediction}
                  style={{
                    backgroundColor: '#0B2545',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Apply AI Risk to Bag
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Transfer Window (min)</label>
                  <input
                    type="number"
                    value={transferMins}
                    onChange={(e) => setTransferMins(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Weather Severity (1-5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={weatherSeverity}
                    onChange={(e) => setWeatherSeverity(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Load Factor (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={loadFactor}
                    onChange={(e) => setLoadFactor(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Hub Congestion (1-5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={congestion}
                    onChange={(e) => setCongestion(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', marginTop: '4px' }}
                  />
                </div>
              </div>

              {riskResult && (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '6px',
                    backgroundColor: riskResult.risk_level === 'HIGH_PRIORITY' ? '#FFEBE6' : '#F0F9F9',
                    border: `1px solid ${riskResult.risk_level === 'HIGH_PRIORITY' ? '#DE350B' : '#006564'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '14px' }}>
                    <span>
                      RISK SCORE: {riskResult.risk_score}/100 ({riskResult.risk_level})
                    </span>
                    <span>CONVEYOR: {riskResult.conveyor_action}</span>
                  </div>
                  <ul style={{ marginTop: '8px', paddingLeft: '18px', fontSize: '12px', color: '#334155' }}>
                    {riskResult.factors.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
                Physical SmartTag E-Ink Live State
              </h2>

              {selectedBag && (
                <>
                  <div
                    style={{
                      backgroundColor: '#F0EFEA',
                      border: '3px solid #1E293B',
                      borderRadius: '8px',
                      padding: '16px',
                      fontFamily: 'monospace',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700 }}>
                      <span>CATHAY PACIFIC</span>
                      <span>UID: {selectedBag.tag_code}</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        margin: '8px 0',
                        borderTop: '2px solid #111',
                        borderBottom: '2px solid #111',
                        padding: '8px 0',
                      }}
                    >
                      <span style={{ fontSize: '26px', fontWeight: 900 }}>{selectedBag.flight_number}</span>
                      <span style={{ fontSize: '26px', fontWeight: 900, color: '#006564' }}>
                        {selectedBag.departure_airport} → {selectedBag.arrival_airport}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700 }}>
                      PAX: {selectedBag.passenger_name} • {selectedBag.cabin_class}
                    </div>
                    <div style={{ fontSize: '12px', marginTop: '2px' }}>
                      TAG: {selectedBag.tag_number} • WT: {selectedBag.weight_kg} KG
                    </div>
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '6px 8px',
                        backgroundColor: selectedBag.is_rush_bag ? '#8B0000' : '#111111',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '12px',
                        textAlign: 'center',
                      }}
                    >
                      {selectedBag.eink_banner}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    <button
                      onClick={handleTriggerIrrops}
                      disabled={isSyncing}
                      style={{
                        width: '100%',
                        backgroundColor: '#DE350B',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '11px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      ⚡ Trigger IRROPS Rebooking & Push E-Ink Update
                    </button>

                    <button
                      onClick={handleHandheldNfcRecover}
                      disabled={isSyncing}
                      style={{
                        width: '100%',
                        backgroundColor: '#006564',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '11px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      📱 Simulate Handheld NFC Tap (Verify Owner & Recover)
                    </button>
                  </div>

                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, marginBottom: '8px' }}>
                    SCAN CHECKPOINT / OVERRIDE MILESTONE
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {OVERRIDE_STATUSES.map((st) => (
                      <button
                        key={st}
                        onClick={() => handleStatusUpdate(st)}
                        disabled={isSyncing}
                        style={{
                          fontSize: '11px',
                          padding: '6px 9px',
                          borderRadius: '4px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: selectedBag.status === st ? '#006564' : '#FFFFFF',
                          color: selectedBag.status === st ? '#FFFFFF' : '#0F172A',
                          fontWeight: selectedBag.status === st ? 700 : 500,
                          cursor: 'pointer',
                        }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Live Audit & Scan Trail</h2>
              {selectedBag?.events.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    borderLeft: '3px solid #006564',
                    paddingLeft: '12px',
                    paddingBottom: '12px',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700 }}>{ev.event_type}</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    {formatTime(ev.timestamp)} • {ev.station_name}
                  </div>
                  {ev.notes && <div style={{ fontSize: '12px', marginTop: '2px' }}>{ev.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
