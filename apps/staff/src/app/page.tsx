'use client';

import React, { useState } from 'react';
import {
  mockBaggageList,
  mockRecoveryCases,
  mockBaggageEvents,
  findFlightById,
  Baggage,
  BaggageEvent,
  BaggageStatus,
  RecoveryCase,
} from '@polyaero/shared';

import {
  applyStatusChange,
  eventsForBag,
  hasOpenCase,
  openRecoveryCase,
  tagDisplayMessage,
} from '../lib/baggageStore';
import { buildTagPayload, tagStatusCode, type TagPayload } from '../lib/tagWriter';
import { writeToTag, type WriteMode } from '../lib/nfcWriter';

const STAFF_ID = 'STF-8821';
const STATION = 'HKG-T1 Ramp Operations';

const OVERRIDE_STATUSES: BaggageStatus[] = [
  'SECURITY_CLEARED',
  'LOADED',
  'IN_FLIGHT',
  'ON_CAROUSEL',
  'CLAIMED',
  'MISROUTED',
  'MISSING',
];

// Formats in UTC so server and browser render identical text (avoids hydration warnings).
function formatTime(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export default function StaffDashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [baggageList, setBaggageList] = useState<Baggage[]>(mockBaggageList);
  const [events, setEvents] = useState<BaggageEvent[]>(mockBaggageEvents);
  const [recoveryCases, setRecoveryCases] = useState<RecoveryCase[]>(mockRecoveryCases);
  const [selectedBag, setSelectedBag] = useState<Baggage | null>(mockBaggageList[0]);
  const [tagStatus, setTagStatus] = useState<'IDLE' | 'WRITING'>('IDLE');
  const [lastWritten, setLastWritten] = useState<TagPayload | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [lastMode, setLastMode] = useState<WriteMode | null>(null);

  // Dynamic calculations from active state
  const totalTracked = baggageList.length;
  const loadedCount = baggageList.filter((b) => b.currentStatus === 'LOADED').length;
  const atRiskCount = baggageList.filter(
    (b) => b.currentStatus === 'MISROUTED' || b.currentStatus === 'MISSING'
  ).length;

  const selectedFlight = selectedBag ? findFlightById(selectedBag.flightId) : undefined;
  const selectedHistory = selectedBag ? eventsForBag(events, selectedBag.id) : [];
  const expectedDisplay = selectedBag ? tagDisplayMessage(selectedBag.currentStatus) : null;

  const tagUpToDate =
    !!selectedBag &&
    lastWritten?.bagId === selectedBag.tagNumber &&
    lastWritten.statusCode === tagStatusCode(selectedBag.currentStatus);

  const filteredBaggage = baggageList.filter((bag) => {
    const flight = findFlightById(bag.flightId);
    const flightNum = flight ? flight.flightNumber.toLowerCase() : '';
    const term = searchTerm.toLowerCase();

    return (
      bag.tagNumber.toLowerCase().includes(term) ||
      bag.bookingReference.toLowerCase().includes(term) ||
      bag.lastKnownLocation.toLowerCase().includes(term) ||
      flightNum.includes(term)
    );
  });

  const handleUpdateStatus = (status: BaggageStatus) => {
    if (!selectedBag) return;
    const { bag: updated, event } = applyStatusChange(selectedBag, {
      status,
      staffId: STAFF_ID,
      stationName: STATION,
      scanner: 'MANUAL_OVERRIDE',
    });
    setBaggageList((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setSelectedBag(updated);
    setEvents((prev) => [event, ...prev]);

    if (status === 'MISSING' && !hasOpenCase(recoveryCases, selectedBag.id)) {
      const newCase = openRecoveryCase(updated, STATION);
      setRecoveryCases((prev) => [newCase, ...prev]);
    }
  };

  const handleWriteToTag = async () => {
    if (!selectedBag) return;
    const payload = buildTagPayload(selectedBag, findFlightById(selectedBag.flightId));
    setTagStatus('WRITING');
    setWriteError(null);
    try {
      // No await before this call, so the browser still treats it as a user tap.
      const outcome = await writeToTag(payload);
      setLastWritten(payload);
      setLastMode(outcome.mode);
    } catch (err) {
      setWriteError(err instanceof Error ? err.message : 'Tag write failed.');
    } finally {
      setTagStatus('IDLE');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
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
            <h1 style={{ fontSize: '18px', fontWeight: 600 }}>
              Cathay SmartTag Ground Staff Operations
            </h1>
            <p style={{ fontSize: '12px', opacity: 0.85 }}>
              Station: HKG (Hong Kong International Airport) • Terminal 1 Ramp Operations
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              padding: '6px 12px',
              borderRadius: '16px',
              fontSize: '12px',
            }}
          >
            Operator: {STAFF_ID} (Ramp Lead)
          </span>
          <span
            style={{
              backgroundColor: '#FFFAE6',
              color: '#7A5200',
              border: '1px solid #FFAB00',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
            }}
            title="Running in local offline simulation mode. Realtime Supabase syncing will activate in Phase 2."
          >
            MOCK MODE (OFFLINE)
          </span>
        </div>
      </header>

      {/* Main Content Grid */}
      <main style={{ flex: 1, padding: '32px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        {/* Prototype Notice */}
        <div
          style={{
            backgroundColor: '#E6F0F0',
            border: '1px solid #006564',
            borderRadius: '8px',
            padding: '12px 20px',
            marginBottom: '24px',
            fontSize: '13px',
            color: '#004B4A',
          }}
        >
          <strong>PolyAero Concept Verification:</strong> Ground Staff verification portal.
          Connected to shared contracts in <code>@polyaero/shared</code>. Active state mutations are preserved in memory for local demo workflows.
        </div>

        {/* Dashboard Metrics Derived from Real State */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>TRACKED BAGS IN SESSION</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#006564', marginTop: '4px' }}>{totalTracked}</div>
            <div style={{ fontSize: '11px', color: '#00875A', marginTop: '4px' }}>Active mock fixture set</div>
          </div>
          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>LOADED / MANIFESTED</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
              {loadedCount} / {totalTracked}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Status milestone confirmed</div>
          </div>
          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>MISROUTED / AT RISK</div>
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
              {atRiskCount > 0 ? 'Requires ramp / transfer inspection' : 'No routing anomalies'}
            </div>
          </div>
          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>ACTIVE RECOVERY CASES</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFAB00', marginTop: '4px' }}>
              {recoveryCases.length}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Investigation in progress</div>
          </div>
        </div>

        {/* 2-Column Working Area */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* Baggage Inventory & Search */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Baggage Registry</h2>
              <input
                type="text"
                placeholder="Search Tag, PNR, Flight, Location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  minWidth: '260px',
                }}
              />
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                  <th style={{ padding: '10px 8px' }}>Tag Number</th>
                  <th style={{ padding: '10px 8px' }}>PNR</th>
                  <th style={{ padding: '10px 8px' }}>Flight</th>
                  <th style={{ padding: '10px 8px' }}>Scale Weight</th>
                  <th style={{ padding: '10px 8px' }}>Current Status</th>
                  <th style={{ padding: '10px 8px' }}>Last Known Location</th>
                  <th style={{ padding: '10px 8px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredBaggage.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                      No matching baggage records found in session.
                    </td>
                  </tr>
                ) : (
                  filteredBaggage.map((bag) => {
                    const flight = findFlightById(bag.flightId);
                    return (
                      <tr
                        key={bag.id}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: selectedBag?.id === bag.id ? '#F0F9F9' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>{bag.tagNumber}</td>
                        <td style={{ padding: '12px 8px' }}>{bag.bookingReference}</td>
                        <td style={{ padding: '12px 8px' }}>{flight ? flight.flightNumber : bag.flightId}</td>
                        <td style={{ padding: '12px 8px' }}>{bag.weightKg} kg</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor:
                                bag.currentStatus === 'LOADED'
                                  ? '#E3FCEF'
                                  : bag.currentStatus === 'MISROUTED' || bag.currentStatus === 'MISSING'
                                  ? '#FFEBE6'
                                  : '#E6F0F0',
                              color:
                                bag.currentStatus === 'LOADED'
                                  ? '#00875A'
                                  : bag.currentStatus === 'MISROUTED' || bag.currentStatus === 'MISSING'
                                  ? '#DE350B'
                                  : '#006564',
                            }}
                          >
                            {bag.currentStatus}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', color: '#64748B' }}>{bag.lastKnownLocation}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <button
                            onClick={() => {
                              setSelectedBag(bag);
                              setTagStatus('IDLE');
                              setWriteError(null);
                            }}
                            style={{
                              backgroundColor: '#006564',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Inspection, History, Recovery */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Inspection Console */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Inspection Console</h2>
              {selectedBag ? (
                <div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>IATA TAG NUMBER</div>
                    <div style={{ fontSize: '16px', fontWeight: 700 }}>{selectedBag.tagNumber}</div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>FLIGHT ASSIGNMENT</div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>
                      {selectedFlight?.flightNumber ?? selectedBag.flightId}
                      {selectedFlight && ` (${selectedFlight.origin} → ${selectedFlight.destination})`}
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>SMARTTAG HARDWARE UID</div>
                    <div style={{ fontSize: '13px', fontFamily: 'monospace' }}>
                      {selectedBag.smartTagId ? '04:A2:3B:4C:5D:6E:70 (Passive RF Bound)' : 'No hardware tag bound'}
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>LAST SCANNED</div>
                    <div style={{ fontSize: '13px' }}>{formatTime(selectedBag.lastScannedAt)}</div>
                  </div>
                  {selectedBag.notes && (
                    <div style={{ marginBottom: '16px', padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '4px', fontSize: '12px' }}>
                      <strong>Ramp Note:</strong> {selectedBag.notes}
                    </div>
                  )}

                  {/* Expected display for the cloud status */}
                  {expectedDisplay && (
                    <div
                      style={{
                        marginBottom: '12px',
                        padding: '8px 12px',
                        backgroundColor: '#0B2545',
                        color: '#FFFFFF',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                      }}
                    >
                      EXPECTED TAG DISPLAY: {expectedDisplay}
                    </div>
                  )}

                  {/* Tag write */}
                  <div style={{ marginBottom: '16px' }}>
                    <div
                      style={{
                        fontSize: '13px',
                        marginBottom: '8px',
                        color: tagUpToDate ? '#00875A' : '#DE350B',
                        fontWeight: 600,
                      }}
                    >
                      {tagUpToDate ? 'Tag matches the cloud' : 'Tag is out of date. Tap to update.'}
                    </div>
                    <button
                      onClick={handleWriteToTag}
                      disabled={tagStatus === 'WRITING'}
                      style={{
                        fontSize: '12px',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor: tagStatus === 'WRITING' ? '#94A3B8' : '#006564',
                        color: '#FFFFFF',
                        cursor: tagStatus === 'WRITING' ? 'default' : 'pointer',
                      }}
                    >
                      {tagStatus === 'WRITING' ? 'Writing to tag…' : 'Write to tag'}
                    </button>
                    {writeError && (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#DE350B' }}>{writeError}</div>
                    )}
                    {lastWritten && lastWritten.bagId === selectedBag.tagNumber && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '8px 12px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          lineHeight: 1.6,
                        }}
                      >
                        BAG ID: {lastWritten.bagId}
                        <br />
                        ROUTE: {lastWritten.route}
                        <br />
                        STATUS: {lastWritten.statusCode}
                        <br />
                        UPDATED: {lastWritten.lastUpdated}
                        <br />
                        MODE:{' '}
                        {lastMode === 'NFC_DATA'
                          ? 'NFC record written. Display refresh not confirmed.'
                          : 'MOCK write. No NFC reader, nothing sent to a tag.'}
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '8px' }}>
                    OVERRIDE BAGGAGE STATUS
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {OVERRIDE_STATUSES.map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateStatus(st)}
                        style={{
                          fontSize: '11px',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: selectedBag.currentStatus === st ? '#006564' : '#FFFFFF',
                          color: selectedBag.currentStatus === st ? '#FFFFFF' : '#0F172A',
                          cursor: 'pointer',
                        }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ color: '#64748B', fontSize: '13px' }}>Select a bag to view details</div>
              )}
            </div>

            {/* Scan History */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Scan History</h2>
              {!selectedBag ? (
                <div style={{ color: '#64748B', fontSize: '13px' }}>Select a bag to view its history</div>
              ) : selectedHistory.length === 0 ? (
                <div style={{ color: '#64748B', fontSize: '13px' }}>No events recorded for this bag.</div>
              ) : (
                <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {selectedHistory.map((ev) => (
                    <li
                      key={ev.id}
                      style={{ borderLeft: '2px solid #006564', paddingLeft: '12px', paddingBottom: '12px' }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{ev.eventType}</div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                        {formatTime(ev.timestamp)} • {ev.stationName}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                        {ev.scannerType} • {ev.handledByStaffId ?? 'system'}
                      </div>
                      {ev.notes && <div style={{ fontSize: '12px', marginTop: '4px' }}>{ev.notes}</div>}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Active Recovery Cases */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
                Active Recovery Cases ({recoveryCases.length})
              </h2>
              {recoveryCases.map((rec) => (
                <div
                  key={rec.id}
                  style={{
                    border: '1px solid #FFAB00',
                    borderRadius: '6px',
                    padding: '12px',
                    backgroundColor: '#FFFAE6',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>{rec.caseNumber}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#FFAB00',
                        color: '#000000',
                        fontWeight: 700,
                      }}
                    >
                      {rec.priority}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '6px' }}>
                    <strong>Status:</strong> {rec.status}
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '2px' }}>
                    <strong>Bag:</strong>{' '}
                    {baggageList.find((b) => b.id === rec.baggageId)?.tagNumber ?? rec.baggageId}
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '2px' }}>
                    <strong>Reported:</strong> {rec.reportedLocation}
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px' }}>{rec.staffNotes}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}