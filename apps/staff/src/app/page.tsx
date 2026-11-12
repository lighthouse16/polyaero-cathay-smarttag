'use client';

import React, { useEffect, useState, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
const STAFF_ID = 'STF-8821';
const STATION = 'HKIA Terminal 1 · Baggage Operations';

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
  tag_interface?: string;
  booking_reference: string;
  passenger_name: string;
  tier_status: string;
  cabin_class: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
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
  model_version?: string;
  recommended_action: string;
  passenger_recovery_choice?: string | null;
  recovery_flight_number?: string | null;
  recovery_eta?: string | null;
  delivery_address?: string | null;
  eink_banner: string;
  updated_at: string;
  events: BaggageEventItem[];
}

const NORMAL_MILESTONES: Array<{ code: string; label: string; sub: string }> = [
  { code: 'TAGGED', label: 'Tag synced', sub: 'SmartTag™ written & paired' },
  { code: 'CHECKED_IN', label: 'Bag accepted', sub: 'Self bag-drop verified' },
  { code: 'LOADED', label: 'Loaded onto aircraft', sub: 'ULD ramp scan complete' },
  { code: 'ARRIVED', label: 'Arrived', sub: 'Destination carousel' },
  { code: 'COLLECTED', label: 'Collected', sub: 'Claimed at arrivals' },
];

const EXCEPTION_MILESTONES: Array<{ code: string; label: string }> = [
  { code: 'MISROUTED', label: 'Misrouted' },
  { code: 'MISSING', label: 'Missing' },
  { code: 'RECOVERY_IN_PROGRESS', label: 'Recovery in process' },
];

function formatMilestoneLabel(statusCode: string): string {
  if (statusCode === 'AWAITING_SYNC') return 'Awaiting tag sync';
  const normal = NORMAL_MILESTONES.find((m) => m.code === statusCode);
  if (normal) return normal.label;
  const exc = EXCEPTION_MILESTONES.find((m) => m.code === statusCode);
  if (exc) return exc.label;
  if (statusCode === 'ON_CAROUSEL') return 'Arrived';
  if (statusCode === 'CLAIMED') return 'Collected';
  return statusCode.replace(/_/g, ' ');
}

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
  const [toast, setToast] = useState<string | null>(null);
  const [transferMins, setTransferMins] = useState<number>(42);
  const [weatherSeverity, setWeatherSeverity] = useState<number>(3);
  const [congestion, setCongestion] = useState<number>(3);

  const handleEvaluateFlightRisk = async () => {
    if (!selectedBag) return;
    setIsSyncing(true);
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
          load_factor_pct: 89,
          airport_congestion: congestion,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        await fetchBags();
        setToast(`AI Risk Score (${result.risk_score}/100) & Arrival ETA sent to ${selectedBag.passenger_name}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

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
    const interval = setInterval(fetchBags, 2500);
    return () => clearInterval(interval);
  }, [fetchBags]);

  const selectedBag = bags.find((b) => b.tag_number === selectedTagNum) || bags[0] || null;
  const priorityQueue = [...bags].sort((a, b) => b.risk_score - a.risk_score);

  const handleResetDemo = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/baggage/reset`, { method: 'POST' });
      if (res.ok) {
        const fresh: LiveBag[] = await res.json();
        setBags(fresh);
        setToast('Demo state reset.');
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
          location_code: 'HKG-T1-OPS',
          station_name: STATION,
          scanner_type: 'NFC_TAP',
          staff_id: STAFF_ID,
          notes: `Updated to ${formatMilestoneLabel(newStatus)}`,
        }),
      });
      if (res.ok) {
        const updated: LiveBag = await res.json();
        setBags((prev) => prev.map((b) => (b.tag_number === updated.tag_number ? updated : b)));
        setToast(`${updated.passenger_name} · ${formatMilestoneLabel(newStatus)}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const totalTracked = bags.length;
  const onTrackCount = bags.filter((b) =>
    ['LOADED', 'ARRIVED', 'COLLECTED', 'ON_CAROUSEL', 'CLAIMED'].includes(b.status)
  ).length;
  const exceptionCount = bags.filter((b) =>
    ['MISROUTED', 'MISSING', 'RECOVERY_IN_PROGRESS'].includes(b.status)
  ).length;

  const filteredBaggage = bags.filter((bag) => {
    const term = searchTerm.toLowerCase();
    return (
      bag.tag_number.toLowerCase().includes(term) ||
      bag.booking_reference.toLowerCase().includes(term) ||
      bag.passenger_name.toLowerCase().includes(term) ||
      bag.flight_number.toLowerCase().includes(term)
    );
  });

  const orderIndexMap: Record<string, number> = {
    AWAITING_SYNC: -1,
    TAGGED: 0,
    CHECKED_IN: 1,
    LOADED: 2,
    ARRIVED: 3,
    ON_CAROUSEL: 3,
    COLLECTED: 4,
    CLAIMED: 4,
  };
  const selectedIsException = selectedBag
    ? ['MISROUTED', 'MISSING', 'RECOVERY_IN_PROGRESS'].includes(selectedBag.status)
    : false;
  const selectedStepIdx = selectedBag ? (orderIndexMap[selectedBag.status] ?? -1) : -1;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F7F7', color: '#1C2024' }}>
      {/* Cathay Pacific Signature Jade Header */}
      <header
        style={{
          background: 'linear-gradient(135deg, #004B4A 0%, #006564 100%)',
          color: '#FFFFFF',
          padding: '18px 36px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 18px rgba(0, 75, 74, 0.14)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img
            src="/cathay/cathay-brushwing-white.png"
            alt="Cathay Pacific"
            style={{ width: '34px', height: '34px', objectFit: 'contain' }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                CATHAY PACIFIC
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  backgroundColor: 'rgba(255,255,255,0.14)',
                  padding: '3px 10px',
                  borderRadius: '999px',
                }}
              >
                BAGGAGE OPERATIONS
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#D7EBE8', marginTop: '2px' }}>
              {STATION} · Operator {STAFF_ID}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleResetDemo}
            disabled={isSyncing}
            style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.14)',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
          <span
            style={{
              padding: '7px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 700,
              backgroundColor: isLiveConnected ? '#EBF4F1' : '#FFEBE6',
              color: isLiveConnected ? '#006564' : '#B91C1C',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isLiveConnected ? '#00875A' : '#DE350B',
              }}
            />
            {isLiveConnected ? 'Live Sync' : 'Offline'}
          </span>
        </div>
      </header>

      <main style={{ maxWidth: '1380px', margin: '0 auto', padding: '28px 36px 56px' }}>
        {toast && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 18px',
              backgroundColor: '#EBF4F1',
              border: '1px solid #006564',
              borderRadius: '12px',
              color: '#004B4A',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>✓ {toast}</span>
            <button
              onClick={() => setToast(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#006564',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Clean 3-Card Summary Row */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '18px',
            marginBottom: '26px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              padding: '20px 24px',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ fontSize: '11.5px', color: '#718096', fontWeight: 700 }}>
              TRACKED BAGS
            </div>
            <div style={{ fontSize: '30px', fontWeight: 700, marginTop: '4px', color: '#1C2024' }}>
              {totalTracked}
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#FFFFFF',
              padding: '20px 24px',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ fontSize: '11.5px', color: '#718096', fontWeight: 700 }}>
              ON SCHEDULE
            </div>
            <div style={{ fontSize: '30px', fontWeight: 700, marginTop: '4px', color: '#006564' }}>
              {onTrackCount}
            </div>
          </div>

          <div
            style={{
              backgroundColor: exceptionCount > 0 ? '#FFF8F6' : '#FFFFFF',
              padding: '20px 24px',
              borderRadius: '16px',
              border: exceptionCount > 0 ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
            }}
          >
            <div style={{ fontSize: '11.5px', color: '#718096', fontWeight: 700 }}>
              ACTIVE RECOVERY CASES
            </div>
            <div
              style={{
                fontSize: '30px',
                fontWeight: 700,
                marginTop: '4px',
                color: exceptionCount > 0 ? '#B91C1C' : '#1C2024',
              }}
            >
              {exceptionCount}
            </div>
          </div>
        </section>

        {/* Main 2-Column Operations Workspace */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '24px' }}>
          {/* Left Column: Priority Queue + Passenger Manifest */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Priority Queue */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '16px 22px',
                  backgroundColor: '#EBF4F1',
                  borderBottom: '1px solid #D7EBE8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <img
                  src="/cathay/icon-suitcase-tag.png"
                  alt=""
                  style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                />
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#004B4A' }}>
                  Baggage Recovery Copilot Queue
                </h2>
              </div>

              <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {priorityQueue.map((item) => {
                  const isSelected = selectedBag?.tag_number === item.tag_number;
                  const isExc = ['MISROUTED', 'MISSING', 'RECOVERY_IN_PROGRESS'].includes(item.status);
                  const isAwaiting = item.status === 'AWAITING_SYNC';
                  return (
                    <div
                      key={item.tag_number}
                      onClick={() => setSelectedTagNum(item.tag_number)}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: isSelected ? '2px solid #006564' : '1px solid #E2E8F0',
                        backgroundColor: isSelected ? '#F4FAF9' : '#FFFFFF',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '14.5px', color: '#1C2024' }}>
                            {item.passenger_name}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '999px',
                              backgroundColor: item.tier_status === 'DIAMOND' ? '#FBF5EA' : '#F1F5F9',
                              color: item.tier_status === 'DIAMOND' ? '#9A7428' : '#475569',
                            }}
                          >
                            {item.tier_status}
                          </span>
                          <span style={{ fontSize: '12.5px', color: '#718096', fontWeight: 600 }}>
                            · {item.flight_number} ({item.departure_airport} → {item.arrival_airport})
                          </span>
                        </div>

                        {item.passenger_recovery_choice && (
                          <div style={{ fontSize: '12px', color: '#006564', fontWeight: 700, marginTop: '5px' }}>
                            ✓ {item.passenger_recovery_choice === 'EXPRESS_NEXT_FLIGHT'
                              ? `Express Flight ${item.recovery_flight_number || ''} · ${item.recovery_eta || ''}`
                              : `Hotel Delivery: ${item.delivery_address || 'Address pending'}`}
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#006564', fontFamily: 'monospace' }}>
                          {item.tag_number}
                        </div>
                        <span
                          style={{
                            marginTop: '4px',
                            display: 'inline-block',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: '999px',
                            backgroundColor: isExc ? '#FEE2E2' : isAwaiting ? '#FEF3C7' : '#EBF4F1',
                            color: isExc ? '#B91C1C' : isAwaiting ? '#92400E' : '#006564',
                          }}
                        >
                          {formatMilestoneLabel(item.status)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Passenger Manifest Table */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '16px 22px',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1C2024' }}>
                  Flight Baggage Manifest
                </h2>
                <input
                  type="text"
                  placeholder="Search tag, passenger, flight..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    fontSize: '12.5px',
                    width: '230px',
                    backgroundColor: '#F8FAFC',
                  }}
                />
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr
                    style={{
                      backgroundColor: '#F8FAFC',
                      color: '#64748B',
                      textAlign: 'left',
                      fontSize: '11px',
                    }}
                  >
                    <th style={{ padding: '12px 22px' }}>TAG NUMBER</th>
                    <th style={{ padding: '12px 16px' }}>PASSENGER</th>
                    <th style={{ padding: '12px 16px' }}>FLIGHT</th>
                    <th style={{ padding: '12px 22px' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBaggage.map((bag) => {
                    const isSelected = selectedBag?.tag_number === bag.tag_number;
                    const isExc = ['MISROUTED', 'MISSING', 'RECOVERY_IN_PROGRESS'].includes(bag.status);
                    const isAwaiting = bag.status === 'AWAITING_SYNC';
                    return (
                      <tr
                        key={bag.tag_number}
                        onClick={() => setSelectedTagNum(bag.tag_number)}
                        style={{
                          borderTop: '1px solid #F1F5F9',
                          backgroundColor: isSelected ? '#EBF4F1' : '#FFFFFF',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '13px 22px', fontWeight: 700, color: '#006564', fontFamily: 'monospace' }}>
                          {bag.tag_number}
                        </td>
                        <td style={{ padding: '13px 16px', fontWeight: 700 }}>{bag.passenger_name}</td>
                        <td style={{ padding: '13px 16px', fontWeight: 600 }}>
                          {bag.flight_number} ({bag.departure_airport} → {bag.arrival_airport})
                        </td>
                        <td style={{ padding: '13px 22px' }}>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: isExc ? '#FEE2E2' : isAwaiting ? '#FEF3C7' : '#EBF4F1',
                              color: isExc ? '#B91C1C' : isAwaiting ? '#92400E' : '#006564',
                            }}
                          >
                            {formatMilestoneLabel(bag.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Selected Bag Journey & Staff Milestone Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {selectedBag && (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  padding: '22px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#006564', fontWeight: 700 }}>
                      PASSENGER SMARTTAG™
                    </div>
                    <h3 style={{ margin: '3px 0 2px', fontSize: '19px', fontWeight: 700 }}>
                      {selectedBag.passenger_name}
                    </h3>
                    <div style={{ fontSize: '12.5px', color: '#4A5568' }}>
                      Tag <strong>{selectedBag.tag_number}</strong> · {selectedBag.flight_number} (
                      {selectedBag.departure_airport} → {selectedBag.arrival_airport})
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: '#FBF5EA',
                      color: '#9A7428',
                    }}
                  >
                    {selectedBag.tier_status}
                  </span>
                </div>

                {/* Live Passenger Recovery Selection Card (Hotel Address or Express Flight + ETA) */}
                {selectedBag.passenger_recovery_choice && (
                  <div
                    style={{
                      backgroundColor: '#EBF4F1',
                      border: '1.5px solid #006564',
                      borderRadius: '12px',
                      padding: '14px',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#006564', marginBottom: '4px' }}>
                      PASSENGER RECOVERY PREFERENCE RECEIVED
                    </div>
                    {selectedBag.passenger_recovery_choice === 'EXPRESS_NEXT_FLIGHT' ? (
                      <>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1C2024' }}>
                          Express Flight: {selectedBag.recovery_flight_number}
                        </div>
                        <div style={{ fontSize: '12.5px', color: '#004B4A', marginTop: '2px' }}>
                          ETA: {selectedBag.recovery_eta}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1C2024' }}>
                          Direct Hotel Delivery
                        </div>
                        <div style={{ fontSize: '12.5px', color: '#1C2024', marginTop: '2px' }}>
                          Address: <strong>{selectedBag.delivery_address}</strong>
                        </div>
                        <div style={{ fontSize: '12px', color: '#004B4A', marginTop: '2px' }}>
                          {selectedBag.recovery_eta}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* 5-Step Journey Timeline Controller */}
                <div
                  style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    padding: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#4A5568',
                      marginBottom: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>JOURNEY MILESTONES</span>
                    <span style={{ color: selectedIsException ? '#B91C1C' : '#006564' }}>
                      {formatMilestoneLabel(selectedBag.status)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {NORMAL_MILESTONES.map((step, idx) => {
                      const isCompleted = !selectedIsException && idx <= selectedStepIdx;
                      const isCurrent = !selectedIsException && idx === selectedStepIdx;
                      return (
                        <div
                          key={step.code}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            backgroundColor: isCurrent ? '#EBF4F1' : '#FFFFFF',
                            border: isCurrent ? '1px solid #006564' : '1px solid #EDF2F7',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                backgroundColor: isCompleted ? '#006564' : '#E2E8F0',
                                color: isCompleted ? '#FFFFFF' : '#718096',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              {isCompleted ? '✓' : idx + 1}
                            </div>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: isCompleted ? '#1C2024' : '#718096' }}>
                                {step.label}
                              </div>
                              <div style={{ fontSize: '11px', color: '#718096' }}>{step.sub}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleStatusUpdate(step.code)}
                            disabled={isSyncing}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '8px',
                              border: isCurrent ? 'none' : '1px solid #CBD5E1',
                              backgroundColor: isCurrent ? '#006564' : '#FFFFFF',
                              color: isCurrent ? '#FFFFFF' : '#006564',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {isCurrent ? 'Active' : 'Set'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Exception & Recovery Status Controls */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#991B1B', fontWeight: 700, marginBottom: '8px' }}>
                    EXCEPTION &amp; RECOVERY STATUS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {EXCEPTION_MILESTONES.map((ex) => {
                      const isActive = selectedBag.status === ex.code;
                      return (
                        <button
                          key={ex.code}
                          onClick={() => handleStatusUpdate(ex.code)}
                          disabled={isSyncing}
                          style={{
                            padding: '10px',
                            borderRadius: '10px',
                            border: '1px solid #FCA5A5',
                            backgroundColor: isActive ? '#B91C1C' : '#FFF5F5',
                            color: isActive ? '#FFFFFF' : '#991B1B',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {ex.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Physical 4.2" E-Ink SmartTag Preview */}
                <div
                  style={{
                    backgroundColor: '#F0EFEA',
                    border: '2px solid #284239',
                    borderRadius: '12px',
                    padding: '14px',
                    fontFamily: 'monospace',
                    color: '#111111',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '10px',
                      fontWeight: 700,
                      borderBottom: '1px solid #111111',
                      paddingBottom: '6px',
                      marginBottom: '8px',
                    }}
                  >
                    <span>4.2&quot; E-INK SMARTTAG™</span>
                    <span>{selectedBag.tag_number}</span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>{selectedBag.passenger_name}</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, margin: '4px 0' }}>
                    {selectedBag.departure_airport} ✈ {selectedBag.arrival_airport} ({selectedBag.flight_number})
                  </div>
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '5px 8px',
                      backgroundColor: selectedIsException ? '#8B0000' : '#006564',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      fontSize: '11px',
                      textAlign: 'center',
                      borderRadius: '4px',
                    }}
                  >
                    {selectedBag.eink_banner}
                  </div>
                </div>
              </div>
            )}

            {/* AI Flight & Bag Risk Predictor (Pluggable ML Interface) */}
            {selectedBag && (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  padding: '22px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#006564', fontWeight: 700 }}>
                      AI RISK ENGINE · {selectedBag.model_version || 'cathay-bag-risk-v1.0'}
                    </div>
                    <h3 style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: 700 }}>
                      Flight &amp; Bag Risk Prediction
                    </h3>
                  </div>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      backgroundColor: selectedBag.risk_score >= 65 ? '#FEF3C7' : '#EBF4F1',
                      color: selectedBag.risk_score >= 65 ? '#B45309' : '#006564',
                    }}
                  >
                    {selectedBag.risk_score}/100 · {selectedBag.risk_level}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#4A5568' }}>
                    Transfer (mins)
                    <input
                      type="number"
                      value={transferMins}
                      onChange={(e) => setTransferMins(Number(e.target.value))}
                      style={{ width: '100%', padding: '7px 8px', marginTop: '4px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                    />
                  </label>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#4A5568' }}>
                    Weather (1–5)
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={weatherSeverity}
                      onChange={(e) => setWeatherSeverity(Number(e.target.value))}
                      style={{ width: '100%', padding: '7px 8px', marginTop: '4px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                    />
                  </label>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#4A5568' }}>
                    Hub Load (1–5)
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={congestion}
                      onChange={(e) => setCongestion(Number(e.target.value))}
                      style={{ width: '100%', padding: '7px 8px', marginTop: '4px', border: '1px solid #CBD5E1', borderRadius: '8px' }}
                    />
                  </label>
                </div>

                <button
                  onClick={handleEvaluateFlightRisk}
                  disabled={isSyncing}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#284239',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                  }}
                >
                  Predict Flight Risk &amp; Push Score to Passenger
                </button>
              </div>
            )}

            {/* Chain-of-Custody Audit Log */}
            {selectedBag && (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  padding: '22px',
                }}
              >
                <h3 style={{ margin: '0 0 12px', fontSize: '14.5px', fontWeight: 700 }}>
                  Scan History
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[...selectedBag.events].reverse().map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        borderLeft: '3px solid #006564',
                        paddingLeft: '12px',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>
                        {formatMilestoneLabel(ev.event_type)}
                      </div>
                      <div style={{ color: '#718096', fontSize: '11px', marginTop: '2px' }}>
                        {formatTime(ev.timestamp)} · {ev.notes || ev.station_name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
