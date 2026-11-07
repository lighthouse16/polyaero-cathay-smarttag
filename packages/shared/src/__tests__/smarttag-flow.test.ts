import { describe, it, expect } from 'vitest';
import {
  InMemorySmartTagRepository,
  DEMO_BOOKING_REFERENCE,
  DEMO_ITINERARY_ID,
  DEFAULT_DECLARATIONS,
  resolveBookingSmartTagEntry,
  runSmartTagSync,
  MockNfcService,
  INfcService,
  SmartTagPayload,
  SmartTagWriteResult,
  SmartTagScanResult,
  buildNfcPayloadForBag,
  encodeInterleaved2Of5,
  NfcSyncMachineState,
} from '../index';

describe('Phase 2 SmartTag Repository & Passenger Flow State Model', () => {
  it('starts with genuine empty bookings by default and populates CX548 on demand', () => {
    const repo = new InMemorySmartTagRepository();
    expect(repo.listItineraries()).toHaveLength(0);

    const added = repo.addDemoItinerary();
    expect(added.id).toBe(DEMO_ITINERARY_ID);
    expect(added.booking.bookingReference).toBe(DEMO_BOOKING_REFERENCE);
    expect(added.flight.flightNumber).toBe('CX548');
    expect(added.flight.origin).toBe('HKG');
    expect(added.flight.destination).toBe('NRT');
    expect(added.travelDateDisplay).toBe('Fri 21 Nov 2026');

    const bags = repo.getBagsForItinerary(added.id);
    expect(bags).toHaveLength(1);
    expect(bags[0].smartTagCode).toBe('ST-2048');
    expect(bags[0].displayBagCode).toBe('CX880123456');
    expect(bags[0].baggage.tagNumber).toBe('0160123456');
    expect(bags[0].setupState).toBe('UNREGISTERED');
    expect(bags[0].smartTag.lastWrittenAt).toBeNull();
  });

  it('rejects unknown booking references and accepts demo reference 8K3F7D', () => {
    const repo = new InMemorySmartTagRepository();
    const invalid = repo.lookupAndAddBookingByRef('ZZ9999');
    expect(invalid.itinerary).toBeUndefined();
    expect(invalid.errorMessage).toContain('8K3F7D');

    const shortRef = repo.lookupAndAddBookingByRef('123');
    expect(shortRef.errorMessage).toContain('valid');

    const valid = repo.lookupAndAddBookingByRef('8k3f7d');
    expect(valid.itinerary?.flight.flightNumber).toBe('CX548');
  });

  it('enforces check-in and declaration completion before preparing SmartTag', () => {
    const repo = new InMemorySmartTagRepository({ populateDemoBookingOnInit: true });
    repo.setCheckInReadiness(DEMO_ITINERARY_ID, 'CHECK_IN_PENDING');

    const blockedByCheckIn = repo.prepareBagsForItinerary({
      itineraryId: DEMO_ITINERARY_ID,
      bagCount: 1,
      declarations: DEFAULT_DECLARATIONS,
    });
    expect(blockedByCheckIn.bags).toHaveLength(0);
    expect(blockedByCheckIn.validationError).toContain('check-in');

    repo.setCheckInReadiness(DEMO_ITINERARY_ID, 'DEMO_CHECK_IN_COMPLETED');
    const blockedByDecl = repo.prepareBagsForItinerary({
      itineraryId: DEMO_ITINERARY_ID,
      bagCount: 1,
      declarations: { ...DEFAULT_DECLARATIONS, dangerousGoodsDeclared: false },
    });
    expect(blockedByDecl.bags).toHaveLength(0);
    expect(blockedByDecl.validationError).toContain('dangerous goods');

    const ok = repo.prepareBagsForItinerary({
      itineraryId: DEMO_ITINERARY_ID,
      bagCount: 1,
      declarations: DEFAULT_DECLARATIONS,
    });
    expect(ok.validationError).toBeUndefined();
    expect(ok.bags).toHaveLength(1);
    expect(ok.bags[0].setupState).toBe('PENDING_PHYSICAL_WRITE');
    // Preparing the tag must NOT mark physical E-ink display as written
    expect(ok.bags[0].smartTag.einkDisplayStatus).toBe('UNPROGRAMMED');
    expect(ok.bags[0].smartTag.lastWrittenAt).toBeNull();
  });

  it('assigns distinct baggage identities and distinct SmartTag devices when multiple bags are selected', () => {
    const repo = new InMemorySmartTagRepository({ populateDemoBookingOnInit: true });
    const res = repo.prepareBagsForItinerary({
      itineraryId: DEMO_ITINERARY_ID,
      bagCount: 2,
      declarations: DEFAULT_DECLARATIONS,
    });
    expect(res.bags).toHaveLength(2);
    const [bag1, bag2] = res.bags;
    expect(bag1.displayBagCode).toBe('CX880123456');
    expect(bag2.displayBagCode).toBe('CX880123457');
    expect(bag1.baggage.tagNumber).not.toBe(bag2.baggage.tagNumber);
    expect(bag1.smartTagCode).toBe('ST-2048');
    expect(bag2.smartTagCode).toBe('ST-2051');
    expect(bag1.smartTag.tagUid).not.toBe(bag2.smartTag.tagUid);
  });

  it('resolves My Bookings entry CTA across unregistered, pending, simulated, verified, and failed states', () => {
    const repo = new InMemorySmartTagRepository({ populateDemoBookingOnInit: true });
    const itin = repo.getItinerary(DEMO_ITINERARY_ID)!;

    // 1. Unregistered
    let entry = resolveBookingSmartTagEntry(itin, repo.getBagsForItinerary(itin.id));
    expect(entry.primaryCtaLabel).toBe('Set up SmartTag');
    expect(entry.targetRoute).toBe('prepare');

    // 2. Prepared -> Continue setup
    const { bags } = repo.prepareBagsForItinerary({
      itineraryId: itin.id,
      bagCount: 1,
      declarations: DEFAULT_DECLARATIONS,
    });
    entry = resolveBookingSmartTagEntry(itin, bags);
    expect(entry.primaryCtaLabel).toBe('Continue setup');
    expect(entry.targetRoute).toBe('sync');

    // 3. Simulated sync -> View SmartTag (Demo)
    const bag = bags[0];
    const payload = buildNfcPayloadForBag(itin, bag);
    const simUpdated = repo.recordSyncOutcome(bag.id, {
      finalState: 'SUCCESS',
      setupState: 'SIMULATED_WRITE_COMPLETED',
      mode: 'SIMULATED_DEMO',
      writeRecord: {
        mode: 'SIMULATED_DEMO',
        timestamp: '2026-11-21T06:00:00Z',
        bytesWritten: 4736,
        tagUid: bag.smartTag.tagUid,
        verifiedHardwareReadback: false,
      },
      failure: null,
      payload,
    });
    entry = resolveBookingSmartTagEntry(itin, [simUpdated]);
    expect(entry.isSimulatedSetup).toBe(true);
    expect(entry.primaryCtaLabel).toContain('Demo');
    expect(entry.targetRoute).toBe('result');
    // Simulated write must not set physical lastWrittenAt
    expect(simUpdated.smartTag.lastWrittenAt).toBeNull();
  });
});

describe('NFC Sync State Machine & Honesty Guarantees', () => {
  const samplePayload: SmartTagPayload = {
    tagUid: '04:A2:3B:4C:5D:6E:70',
    baggageTagNumber: '0160123456',
    flightNumber: 'CX548',
    originAirport: 'HKG',
    destinationAirport: 'NRT',
    passengerInitials: 'H.T.',
    departureDate: '2026-11-21',
    barcodeSymbology: 'INTERLEAVED_2_OF_5',
  };

  it('reports UNSUPPORTED honestly when physical hardware mode has no native E-ink driver', async () => {
    const visited: NfcSyncMachineState[] = [];
    const outcome = await runSmartTagSync({
      mode: 'PHYSICAL_HARDWARE',
      service: null,
      payload: samplePayload,
      expectedTagUid: samplePayload.tagUid,
      stepDelayMs: 0,
      onStep: (u) => visited.push(u.state),
    });

    expect(visited).toEqual(['CHECKING_AVAILABILITY', 'UNSUPPORTED']);
    expect(outcome.finalState).toBe('UNSUPPORTED');
    expect(outcome.setupState).toBe('PENDING_PHYSICAL_WRITE');
    expect(outcome.writeRecord).toBeNull();
    expect(outcome.failure?.canSwitchToDemo).toBe(true);
  });

  it('steps through simulation states and marks result as SIMULATED_WRITE_COMPLETED', async () => {
    const nfc = new MockNfcService();
    const visited: NfcSyncMachineState[] = [];
    const outcome = await runSmartTagSync({
      mode: 'SIMULATED_DEMO',
      service: nfc,
      payload: samplePayload,
      expectedTagUid: samplePayload.tagUid,
      stepDelayMs: 0,
      onStep: (u) => visited.push(u.state),
    });

    expect(visited).toEqual([
      'CHECKING_AVAILABILITY',
      'READY_TO_SCAN',
      'SCANNING',
      'TAG_DETECTED',
      'WRITING',
      'VERIFYING',
      'SUCCESS',
    ]);
    expect(outcome.setupState).toBe('SIMULATED_WRITE_COMPLETED');
    expect(outcome.writeRecord?.mode).toBe('SIMULATED_DEMO');
    expect(outcome.writeRecord?.verifiedHardwareReadback).toBe(false);
  });

  it('refuses to mark physical sync verified if a mock service or unverified readback is passed to PHYSICAL_HARDWARE mode', async () => {
    const nfc = new MockNfcService();
    const outcome = await runSmartTagSync({
      mode: 'PHYSICAL_HARDWARE',
      service: nfc,
      payload: samplePayload,
      expectedTagUid: samplePayload.tagUid,
      stepDelayMs: 0,
    });

    expect(outcome.finalState).toBe('FAILED');
    expect(outcome.setupState).toBe('WRITE_FAILED');
    expect(outcome.failure?.code).toBe('NFC_UNVERIFIED_READBACK');
  });

  it('marks PHYSICALLY_WRITTEN_AND_VERIFIED only when hardware service confirms non-mock verifiedReadback', async () => {
    const verifiedHardwareStub: INfcService = {
      isAvailable: async () => true,
      isEnabled: async () => true,
      readTagUid: async (): Promise<SmartTagScanResult> => ({
        tagUid: samplePayload.tagUid,
        isMockSimulation: false,
      }),
      writeEinkDisplay: async (p): Promise<SmartTagWriteResult> => ({
        success: true,
        tagUid: p.tagUid,
        bytesWritten: 4736,
        timestamp: '2026-11-21T07:00:00Z',
        isMockSimulation: false,
        verifiedReadback: true,
      }),
      cancelScan: async () => {},
    };

    const outcome = await runSmartTagSync({
      mode: 'PHYSICAL_HARDWARE',
      service: verifiedHardwareStub,
      payload: samplePayload,
      expectedTagUid: samplePayload.tagUid,
      stepDelayMs: 0,
    });

    expect(outcome.finalState).toBe('SUCCESS');
    expect(outcome.setupState).toBe('PHYSICALLY_WRITTEN_AND_VERIFIED');
    expect(outcome.writeRecord?.verifiedHardwareReadback).toBe(true);
  });

  it('handles NFC disabled, timeout, cancellation, write failure, and wrong tag UID without marking tag synchronized', async () => {
    const nfc = new MockNfcService();

    // 1. Disabled
    nfc.setMockEnabled(false);
    const disabledOut = await runSmartTagSync({
      mode: 'SIMULATED_DEMO',
      service: nfc,
      payload: samplePayload,
      expectedTagUid: samplePayload.tagUid,
      stepDelayMs: 0,
    });
    expect(disabledOut.finalState).toBe('FAILED');
    expect(disabledOut.failure?.code).toBe('NFC_DISABLED');
    expect(disabledOut.failure?.canOpenSettings).toBe(true);
    nfc.setMockEnabled(true);

    // 2. Timeout
    nfc.setSimulateTimeout(true);
    const timeoutOut = await runSmartTagSync({
      mode: 'SIMULATED_DEMO',
      service: nfc,
      payload: samplePayload,
      expectedTagUid: samplePayload.tagUid,
      stepDelayMs: 0,
    });
    expect(timeoutOut.finalState).toBe('FAILED');
    expect(timeoutOut.failure?.code).toBe('NFC_TIMEOUT');
    nfc.setSimulateTimeout(false);

    // 3. Write failure
    nfc.setSimulateWriteFailure(true);
    const writeFailOut = await runSmartTagSync({
      mode: 'SIMULATED_DEMO',
      service: nfc,
      payload: samplePayload,
      expectedTagUid: samplePayload.tagUid,
      stepDelayMs: 0,
    });
    expect(writeFailOut.finalState).toBe('FAILED');
    expect(writeFailOut.setupState).toBe('WRITE_FAILED');
    expect(writeFailOut.failure?.code).toBe('NFC_WRITE_FAILED');
    nfc.setSimulateWriteFailure(false);

    // 4. Wrong tag UID
    const wrongTagOut = await runSmartTagSync({
      mode: 'SIMULATED_DEMO',
      service: nfc,
      payload: samplePayload,
      expectedTagUid: '04:FF:FF:FF:FF:FF:FF',
      stepDelayMs: 0,
    });
    expect(wrongTagOut.finalState).toBe('FAILED');
    expect(wrongTagOut.setupState).toBe('WRITE_FAILED');
    expect(wrongTagOut.failure?.code).toBe('NFC_WRONG_TAG');

    // 5. Cancellation
    const cancelPromise = runSmartTagSync({
      mode: 'SIMULATED_DEMO',
      service: nfc,
      payload: samplePayload,
      expectedTagUid: samplePayload.tagUid,
      stepDelayMs: 10,
    });
    setTimeout(() => {
      nfc.cancelScan();
    }, 35);
    const cancelOut = await cancelPromise;
    expect(cancelOut.finalState).toBe('CANCELLED');
    expect(cancelOut.setupState).toBe('PENDING_PHYSICAL_WRITE');
  });
});

describe('Baggage Journey Timeline & Recovery Case Lifecycle', () => {
  it('orders baggage milestones chronologically and keeps future milestones pending', () => {
    const repo = new InMemorySmartTagRepository({ populateDemoBookingOnInit: true });
    const { bags } = repo.prepareBagsForItinerary({
      itineraryId: DEMO_ITINERARY_ID,
      bagCount: 1,
      declarations: DEFAULT_DECLARATIONS,
    });
    const bag = bags[0];

    // Before sync: Tag synced is current, all airport milestones are pending
    let view = repo.getJourneyView(DEMO_ITINERARY_ID, bag.id)!;
    expect(view.items.map((i) => i.state)).toEqual([
      'current',
      'pending',
      'pending',
      'pending',
      'pending',
    ]);

    // Seed "Arrived in Tokyo" (matches Design 05: first 4 completed, Collected pending)
    repo.seedDemoJourneyMilestonePreset(bag.id, 'ARRIVED_TOKYO');
    view = repo.getJourneyView(DEMO_ITINERARY_ID, bag.id)!;
    expect(view.statusBadgeLabel).toBe('In journey');
    expect(view.items.map((i) => i.state)).toEqual([
      'completed',
      'completed',
      'completed',
      'completed',
      'pending',
    ]);
    expect(view.items[1].subtitle).toContain('10:42');
    expect(view.items[3].title).toBe('Arrived in Tokyo');
    expect(view.items[4].subtitle).toBe('Not yet completed');
  });

  it('validates recovery case creation and advances recovery status through resolution', () => {
    const repo = new InMemorySmartTagRepository({ populateDemoBookingOnInit: true });
    const bag = repo.getBagsForItinerary(DEMO_ITINERARY_ID)[0];

    const invalid = repo.createRecoveryCase({
      itineraryId: DEMO_ITINERARY_ID,
      bagSetupId: bag.id,
      issueType: 'DELAYED',
      description: 'short',
      contactEmail: 'haidang.trinh@gmail.com',
    });
    expect(invalid.record).toBeUndefined();
    expect(invalid.validationError).toContain('8 characters');

    const created = repo.createRecoveryCase({
      itineraryId: DEMO_ITINERARY_ID,
      bagSetupId: bag.id,
      issueType: 'DELAYED',
      description: 'Black hard-shell suitcase did not appear on Carousel 5 at NRT.',
      contactEmail: 'haidang.trinh@gmail.com',
      contactPhone: '+852 70516618',
      lastSeenLocation: 'HKG Terminal 1 Bag Drop',
    });
    expect(created.validationError).toBeUndefined();
    expect(created.record?.recoveryCase.caseNumber).toMatch(/^REC-2026-\d{4}$/);
    expect(created.record?.progressState).toBe('CASE_SUBMITTED');

    const advanced = repo.advanceRecoveryProgress(bag.id, 'LOCATED');
    expect(advanced?.progressState).toBe('BAGGAGE_LOCATED');

    const resolved = repo.advanceRecoveryProgress(bag.id, 'RESOLVED');
    expect(resolved?.progressState).toBe('RESOLVED');
  });

  it('encodes 10-digit IATA license plate into Interleaved 2 of 5 bar/space modules', () => {
    const modules = encodeInterleaved2Of5('0160123456');
    // 4 start + 10*5 digits + 3 stop = 57 modules
    expect(modules).toHaveLength(57);
    expect(modules[0]).toEqual({ isBar: true, widthUnits: 1 });
    expect(modules[modules.length - 1]).toEqual({ isBar: true, widthUnits: 1 });
  });
});
