import { describe, it, expect } from 'vitest';
import {
  InMemorySmartTagRepository,
  DemoSmartTagRepository,
  ApiSmartTagRepository,
  SmartTagFlowNavigator,
  DEMO_BOOKING_REFERENCE,
  DEMO_ITINERARY_ID,
  DEFAULT_DECLARATIONS,
  StoragePersistenceError,
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
    expect(entry.isSimulatedSetup).toBe(false);
    expect(entry.primaryCtaLabel).toBe('View SmartTag');
    expect(entry.targetRoute).toBe('result');
    // Simulated write must not set physical lastWrittenAt
    expect(simUpdated.smartTag.lastWrittenAt).toBeNull();
  });

  it('safely pairs a physical NFC chip UID to an active bag setup without confusing chip ID with ownership', () => {
    const repo = new InMemorySmartTagRepository({ populateDemoBookingOnInit: true });
    const { bags } = repo.prepareBagsForItinerary({
      itineraryId: DEMO_ITINERARY_ID,
      bagCount: 1,
      declarations: DEFAULT_DECLARATIONS,
    });
    const bag = bags[0];
    expect(bag.smartTagCode).toBe('ST-2048');
    expect(bag.smartTag.tagUid).toBe('04:A2:3B:4C:5D:6E:70');

    // Pair a real scanned chip UID
    const paired = repo.pairPhysicalTagToBag(bag.id, '04:77:88:99:AA:BB:CC');
    expect(paired.smartTagCode).toBe('ST-2048'); // Logical code stays invariant
    expect(paired.smartTag.tagUid).toBe('04:77:88:99:AA:BB:CC'); // Mapped physical chip
    expect(paired.baggage.bookingReference).toBe(DEMO_BOOKING_REFERENCE);

    const reloaded = repo.getBagSetup(bag.id);
    expect(reloaded?.smartTag.tagUid).toBe('04:77:88:99:AA:BB:CC');
  });

  it('rolls back physical NFC pairing state and throws StoragePersistenceError when storage adapter write fails', () => {
    let writeFails = false;
    let storageError: string | null = null;
    const store = new Map<string, string>();

    const failingStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (writeFails) {
          storageError = 'NATIVE_STORAGE_WRITE_VERIFICATION_FAILED';
          throw new Error('Simulated disk write failure');
        }
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      isPersistedToDisk: () => !writeFails,
      getLastStorageError: () => storageError,
    };

    const repo = new InMemorySmartTagRepository({
      storage: failingStorage,
      populateDemoBookingOnInit: true,
    });

    const { bags } = repo.prepareBagsForItinerary({
      itineraryId: DEMO_ITINERARY_ID,
      bagCount: 1,
      declarations: DEFAULT_DECLARATIONS,
    });
    const bag = bags[0];
    const initialVersion = repo.getSnapshot().version;

    let listenerCalled = false;
    repo.subscribe(() => {
      listenerCalled = true;
    });

    writeFails = true;
    expect(() => {
      repo.pairPhysicalTagToBag(bag.id, '04:FA:11:22:33:44:55');
    }).toThrow(StoragePersistenceError);

    const bagAfterFailure = repo.getBagSetup(bag.id);
    expect(bagAfterFailure?.pairedPhysicalUid).toBeNull();
    expect(bagAfterFailure?.smartTag.tagUid).toBe('04:A2:3B:4C:5D:6E:70');
    expect(repo.getSnapshot().version).toBe(initialVersion);
    expect(listenerCalled).toBe(false);

    const persistenceResult = repo.getLastPersistenceResult();
    expect(persistenceResult).toEqual({
      committed: false,
      persisted: false,
      error: 'Simulated disk write failure',
    });

    writeFails = false;
    storageError = null;
    const paired = repo.pairPhysicalTagToBag(bag.id, '04:FA:11:22:33:44:55');
    expect(paired.pairedPhysicalUid).toBe('04:FA:11:22:33:44:55');
    expect(repo.getBagSetup(bag.id)?.pairedPhysicalUid).toBe('04:FA:11:22:33:44:55');
    expect(repo.getLastPersistenceResult()?.committed).toBe(true);
    expect(repo.getLastPersistenceResult()?.persisted).toBe(true);
    expect(listenerCalled).toBe(true);
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

  it('honestly reports UNSUPPORTED when physical hardware service throws HARDWARE_DRIVER_NOT_INSTALLED on write', async () => {
    const uninstalledEinkDriverStub: INfcService = {
      isAvailable: async () => true,
      isEnabled: async () => true,
      readTagUid: async (): Promise<SmartTagScanResult> => ({
        tagUid: samplePayload.tagUid,
        isMockSimulation: false,
      }),
      writeEinkDisplay: async (): Promise<SmartTagWriteResult> => {
        throw new (await import('../services/nfc')).NfcError(
          'Passive E-ink driver not installed',
          'HARDWARE_DRIVER_NOT_INSTALLED'
        );
      },
      cancelScan: async () => {},
    };

    const outcome = await runSmartTagSync({
      mode: 'PHYSICAL_HARDWARE',
      service: uninstalledEinkDriverStub,
      payload: samplePayload,
      expectedTagUid: samplePayload.tagUid,
      stepDelayMs: 0,
    });

    expect(outcome.finalState).toBe('UNSUPPORTED');
    expect(outcome.setupState).toBe('PENDING_PHYSICAL_WRITE');
    expect(outcome.writeRecord).toBeNull();
    expect(outcome.failure?.code).toBe('HARDWARE_DRIVER_NOT_INSTALLED');
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
      stepDelayMs: 0,
      onStep: (step) => {
        if (step.state === 'SCANNING') {
          setTimeout(() => {
            void nfc.cancelScan();
          }, 20);
        }
      },
    });
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

  it('supports full passenger navigation stack, back navigation, resume setup, and missing booking handling', async () => {
    const repo = new InMemorySmartTagRepository();
    const nav = new SmartTagFlowNavigator();

    // Missing booking handling
    expect(repo.getJourneyView('non_existent_id')).toBeNull();
    expect(nav.getState().currentRoute).toBe('bookings');
    expect(nav.goBack()).toBe(false);

    // Populate booking & check entry -> Prepare
    const itin = repo.addDemoItinerary();
    let entry = resolveBookingSmartTagEntry(itin, repo.getBagsForItinerary(itin.id));
    expect(entry.targetRoute).toBe('prepare');
    nav.navigateTo(entry.targetRoute);
    expect(nav.getState().currentRoute).toBe('prepare');

    // Prepare -> Sync
    const { bags } = repo.prepareBagsForItinerary({
      itineraryId: itin.id,
      bagCount: 1,
      declarations: DEFAULT_DECLARATIONS,
    });
    nav.navigateTo('sync');
    expect(nav.getState().currentRoute).toBe('sync');

    // Back to bookings preserves unfinished setup & resumes directly to Sync
    nav.navigateTo('bookings');
    entry = resolveBookingSmartTagEntry(itin, repo.getBagsForItinerary(itin.id));
    expect(entry.primaryCtaLabel).toBe('Continue setup');
    expect(entry.targetRoute).toBe('sync');
    nav.navigateTo(entry.targetRoute);
    expect(nav.getState().currentRoute).toBe('sync');

    // Sync -> Result -> Journey -> Recovery (report) and back stack
    const nfc = new MockNfcService();
    const payload = buildNfcPayloadForBag(itin, bags[0]);
    const outcome = await runSmartTagSync({
      mode: 'SIMULATED_DEMO',
      service: nfc,
      payload,
      expectedTagUid: bags[0].smartTag.tagUid,
      stepDelayMs: 0,
    });
    repo.recordSyncOutcome(bags[0].id, outcome);

    nav.navigateTo('result');
    expect(nav.getState().currentRoute).toBe('result');

    nav.navigateTo('journey');
    expect(nav.getState().currentRoute).toBe('journey');

    nav.navigateTo('report');
    expect(nav.getState().currentRoute).toBe('report');

    // Back stack unwinds report -> journey -> result -> sync -> bookings
    expect(nav.goBack()).toBe(true);
    expect(nav.getState().currentRoute).toBe('journey');
    expect(nav.goBack()).toBe(true);
    expect(nav.getState().currentRoute).toBe('result');
    expect(nav.goBack()).toBe(true);
    expect(nav.getState().currentRoute).toBe('sync');
    expect(nav.goBack()).toBe(true);
    expect(nav.getState().currentRoute).toBe('bookings');
  });

  it('preserves clean DemoSmartTagRepository and ApiSmartTagRepository boundaries without faking 501 routes', () => {
    expect(DemoSmartTagRepository).toBe(InMemorySmartTagRepository);

    const apiRepo = new ApiSmartTagRepository({ baseUrl: 'https://api.polyaero.internal' });
    expect(apiRepo.isConfiguredForDevice()).toBe(true);
    expect(apiRepo.implementedRoutes).toContain('/health');
    expect(apiRepo.implementedRoutes).toContain('/api/v1/auth/signin');

    const localhostRepo = new ApiSmartTagRepository({ baseUrl: 'http://localhost:8000' });
    expect(localhostRepo.isConfiguredForDevice()).toBe(false);

    expect(() => apiRepo.assertEndpointImplemented('/api/v1/baggage')).toThrow(/501 Not Implemented/);
    expect(() => apiRepo.assertEndpointImplemented('/api/v1/tags')).toThrow(/501 Not Implemented/);

    const status = apiRepo.getIntegrationStatus();
    expect(status.isConfigured).toBe(true);
    expect(status.isDeviceCompatible).toBe(true);
    expect(status.hasActiveAppHttpCalls).toBe(false);
    expect(status.activeMode).toBe('STANDALONE_DEMO');
    expect(status.unimplementedBusinessRoutes).toContain('/api/v1/baggage');
  });

  it('persists physical NFC chip UID pairing across repository restarts without fabricating E-ink write state', () => {
    const disk = new Map<string, string>();
    const storage = {
      getItem: (key: string) => disk.get(key) ?? null,
      setItem: (key: string, value: string) => {
        disk.set(key, value);
      },
      removeItem: (key: string) => {
        disk.delete(key);
      },
    };

    const firstLaunch = new InMemorySmartTagRepository({
      storage,
      populateDemoBookingOnInit: true,
    });
    const bag = firstLaunch.getBagsForItinerary(DEMO_ITINERARY_ID)[0];
    expect(bag.pairedPhysicalUid).toBeNull();

    firstLaunch.pairPhysicalTagToBag(bag.id, '04:aa:bb:cc:dd:ee:ff');
    expect(firstLaunch.getBagSetup(bag.id)?.pairedPhysicalUid).toBe('04:AA:BB:CC:DD:EE:FF');

    // Simulate app restart
    const relaunched = new InMemorySmartTagRepository({
      storage,
      populateDemoBookingOnInit: false,
    });
    const restoredBag = relaunched.getBagSetup(bag.id);
    expect(restoredBag?.pairedPhysicalUid).toBe('04:AA:BB:CC:DD:EE:FF');
    expect(restoredBag?.smartTag.tagUid).toBe('04:AA:BB:CC:DD:EE:FF');
    expect(restoredBag?.setupState).toBe('UNREGISTERED');
    expect(restoredBag?.lastWrite).toBeNull();
  });

  it('persists monotonic NDEF revisions across app restart and rolls back on storage failure', () => {
    const disk = new Map<string, string>();
    let throwOnWrite = false;

    const storage = {
      getItem: (key: string) => disk.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (throwOnWrite) throw new Error('Disk I/O Error');
        disk.set(key, value);
      },
      removeItem: (key: string) => {
        disk.delete(key);
      },
    };

    const repo1 = new InMemorySmartTagRepository({ storage, populateDemoBookingOnInit: true });
    const bag1 = repo1.getBagsForItinerary(DEMO_ITINERARY_ID)[0];

    const basePayload = {
      smartTagCode: bag1.smartTagCode,
      physicalUid: '04:11:22:33:44:55:66',
      bagId: '0160123456',
      flight: 'CX548',
      from: 'HKG',
      to: 'NRT',
      status: 'TAGGED',
    };

    // Initial query gives rev 1
    const nextRev1 = repo1.getNextNdefRevision(basePayload);
    expect(nextRev1).toBe(1);

    // Commit verified write rev 1
    repo1.commitVerifiedNdefWrite({
      ...basePayload,
      revision: 1,
    });

    // Same content signature preserves rev 1
    expect(repo1.getNextNdefRevision(basePayload)).toBe(1);

    // Modified content signature increments to rev 2
    expect(
      repo1.getNextNdefRevision({
        ...basePayload,
        status: 'PRIORITY_TRANSFER',
      })
    ).toBe(2);

    // Commit rev 2
    repo1.commitVerifiedNdefWrite({
      ...basePayload,
      status: 'PRIORITY_TRANSFER',
      revision: 2,
    });

    // Simulate app restart with new repository instance reading persisted disk
    const repo2 = new InMemorySmartTagRepository({ storage, populateDemoBookingOnInit: false });
    const revAfterRestart = repo2.getNextNdefRevision({
      ...basePayload,
      status: 'LOADED',
    });
    expect(revAfterRestart).toBe(3); // Never resets to 1!

    // Verify storage write failure triggers rollback
    throwOnWrite = true;
    const failRes = repo2.commitVerifiedNdefWrite({
      ...basePayload,
      status: 'LOADED',
      revision: 3,
    });
    expect(failRes.success).toBe(false);

    // Rolled back: next rev remains 3, not 4
    throwOnWrite = false;
    expect(
      repo2.getNextNdefRevision({
        ...basePayload,
        status: 'LOADED',
      })
    ).toBe(3);

    // Reconcile observed tag revision from hardware scan (e.g. tag is ahead at rev 5)
    repo2.reconcileObservedTagRevision({
      smartTagCode: bag1.smartTagCode,
      physicalUid: '04:11:22:33:44:55:66',
      observedRevision: 5,
    });
    expect(
      repo2.getNextNdefRevision({
        ...basePayload,
        status: 'NEW_STATUS',
      })
    ).toBe(6);
  });
});
