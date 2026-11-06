'use client';

import React, { useState } from 'react';
import {
  mockBaggageList,
  mockRecoveryCases,
  findFlightById,
  Baggage,
  BaggageStatus,
  RecoveryCase,
} from '@polyaero/shared';

export default function StaffDashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [baggageList, setBaggageList] = useState<Baggage[]>(mockBaggageList);
  const [recoveryCases] = useState<RecoveryCase[]>(mockRecoveryCases);
  const [selectedBag, setSelectedBag] = useState<Baggage | null>(mockBaggageList[0]);

  // Dynamic calculations from active state
  const totalTracked = baggageList.length;
  const loadedCount = baggageList.filter((b) => b.currentStatus === 'LOADED').length;
  const atRiskCount = baggageList.filter(
    (b) => b.currentStatus === 'MISROUTED' || b.currentStatus === 'MISSING'
  ).length;

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
    const now = new Date().toISOString();
    const updatedList = baggageList.map((b) =>
      b.id === selectedBag.id ? { ...b, currentStatus: status, lastScannedAt: now } : b
    );
    setBaggageList(updatedList);
    setSelectedBag({ ...selectedBag, currentStatus: status, lastScannedAt: now });
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
            Operator: STF-8821 (Ramp Lead)
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
            <div style={{ fontSize: '28px', fontWeight: 700, color: atRiskCount > 0 ? '#DE350B' : '#00875A', marginTop: '4px' }}>
              {atRiskCount}
            </div>
            <div style={{ fontSize: '11px', color: atRiskCount > 0 ? '#DE350B' : '#00875A', marginTop: '4px' }}>
              {atRiskCount > 0 ? 'Requires ramp / transfer inspection' : 'No routing anomalies'}
            </div>
          </div>
          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>ACTIVE RECOVERY CASES</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#FFAB00', marginTop: '4px' }}>{recoveryCases.length}</div>
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
                                : bag.currentStatus === 'MISROUTED'
                                ? '#FFEBE6'
                                : '#E6F0F0',
                            color:
                              bag.currentStatus === 'LOADED'
                                ? '#00875A'
                                : bag.currentStatus === 'MISROUTED'
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
                          onClick={() => setSelectedBag(bag)}
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
                }))}
              </tbody>
            </table>
          </div>

          {/* Baggage Inspection & Recovery Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
                Inspection Console
              </h2>
              {selectedBag ? (
                <div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>IATA TAG NUMBER</div>
                    <div style={{ fontSize: '16px', fontWeight: 700 }}>{selectedBag.tagNumber}</div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>FLIGHT ASSIGNMENT</div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>
                      {findFlightById(selectedBag.flightId)?.flightNumber ?? selectedBag.flightId} (
                      {findFlightById(selectedBag.flightId)?.origin} →{' '}
                      {findFlightById(selectedBag.flightId)?.destination})
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
                    <div style={{ fontSize: '13px' }}>{selectedBag.lastScannedAt}</div>
                  </div>
                  {selectedBag.notes && (
                    <div style={{ marginBottom: '16px', padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '4px', fontSize: '12px' }}>
                      <strong>Ramp Note:</strong> {selectedBag.notes}
                    </div>
                  )}

                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, marginBottom: '8px' }}>
                    OVERRIDE BAGGAGE STATUS
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(['SECURITY_CLEARED', 'LOADED', 'ON_CAROUSEL', 'MISROUTED'] as BaggageStatus[]).map((st) => (
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
                    <strong>Reported:</strong> {rec.reportedLocation}
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px' }}>
                    {rec.staffNotes}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
