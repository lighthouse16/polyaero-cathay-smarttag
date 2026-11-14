import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acknowledgePhysicalSync, buildOwnedBagPayload, selectOwnedSyncBag } from '../smartTagSync';
import { apiRequest } from '../api';
vi.mock('../api', () => ({ apiRequest: vi.fn() }));
const bag = { id: 'bag-1', tag_id: 'tag-1', tag_number: '0160892012', tag_code: '04:A2:3B:4C:5D:6E:70', flight_id: 'flight-1', booking_reference: 'ABC123', flight_number: 'CX548', departure_airport: 'HKG', arrival_airport: 'NRT', departure_time: '2026-11-21T10:00:00Z', passenger_name: 'CHAN/TAI MAN', weight_kg: 20, status: 'TAGGED', is_tag_synced: true, events: [] as { id: string; timestamp: string; event_type: string }[] };
const saved = { ...bag, events: [{ id: 'event-new', timestamp: '2026-11-21T10:05:00Z', event_type: 'SYNCHRONIZED' }] };
const verified = { finalState: 'SUCCESS', mode: 'PHYSICAL_HARDWARE', setupState: 'PHYSICALLY_WRITTEN_AND_VERIFIED', writeRecord: { tagUid: bag.tag_code, verifiedHardwareReadback: true }, payload: { tagUid: bag.tag_code, baggageTagNumber: bag.tag_number, flightNumber: bag.flight_number, originAirport: 'HKG', destinationAirport: 'NRT', departureDate: '2026-11-21', passengerInitials: 'CTM', barcodeSymbology: 'INTERLEAVED_2_OF_5' } };
beforeEach(() => { vi.mocked(apiRequest).mockReset(); });
describe('physical sync acknowledgement', () => {
  it('saves verified owned identity through bearer API and checks persisted event', async () => {
    vi.mocked(apiRequest).mockResolvedValue(saved);
    expect(await acknowledgePhysicalSync(verified as never, bag)).toEqual(saved);
    expect(apiRequest).toHaveBeenCalledWith('/baggage/sync', expect.objectContaining({ method: 'POST', body: JSON.stringify({ tag_code: bag.tag_code, tag_number: bag.tag_number, flight_id: bag.flight_id, weight_kg: 20, sync_status: 'SYNCHRONIZED' }) }), true);
  });
  it.each([{ ...verified, mode: 'SIMULATED_DEMO' }, { ...verified, finalState: 'FAILED' }, { ...verified, writeRecord: { tagUid: bag.tag_code, verifiedHardwareReadback: false } }])('rejects unverified or simulated outcome without API writes', async (outcome) => {
    await expect(acknowledgePhysicalSync(outcome as never, bag)).rejects.toThrow();
    expect(apiRequest).not.toHaveBeenCalled();
  });
  it.each([null, { ...saved, id: 'other' }, { ...saved, tag_id: 'other' }, { ...saved, tag_id: undefined }, { ...saved, events: [{ id: '', timestamp: 'invalid', event_type: 'SYNCHRONIZED' }] }, { ...saved, tag_code: 'OTHER' }, { ...saved, tag_number: '0160000000' }, { ...saved, flight_id: 'other' }, { ...saved, is_tag_synced: false }, { ...saved, events: [] }, { ...saved, status: 'AWAITING_SYNC' }, { ...saved, status: 'CHECKED_IN' }, { ...saved, flight_number: 'CX999' }, { ...saved, booking_reference: 'OTHER' }, { ...saved, events: [{ event_type: 'SYNCHRONIZED' }, { event_type: 'TAG_TAPPED' }] }])('rejects missing/mismatched acknowledgement', async (reply) => {
    vi.mocked(apiRequest).mockResolvedValue(reply);
    await expect(acknowledgePhysicalSync(verified as never, bag)).rejects.toThrow();
  });
  it.each([{ ...verified.payload, passengerInitials: 'OTHER' }, { ...verified.payload, barcodeSymbology: 'CODE_128' }])('rejects local passenger or barcode fields differing from server', async (payload) => {
    await expect(acknowledgePhysicalSync({ ...verified, payload } as never, bag)).rejects.toThrow();
    expect(apiRequest).not.toHaveBeenCalled();
  });
  it('rejects previously seen sync event', async () => {
    vi.mocked(apiRequest).mockResolvedValue(saved);
    await expect(acknowledgePhysicalSync(verified as never, saved)).rejects.toThrow();
  });
  it('retries API save using the same verified write', async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(saved);
    await expect(acknowledgePhysicalSync(verified as never, bag)).rejects.toThrow('offline');
    await expect(acknowledgePhysicalSync(verified as never, bag)).resolves.toEqual(saved);
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });
  it('retains verified write across sign-in retry without device secrets', async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error('Please sign in to continue.')).mockResolvedValueOnce(saved);
    await expect(acknowledgePhysicalSync(verified as never, bag)).rejects.toThrow('Please sign in');
    await expect(acknowledgePhysicalSync(verified as never, bag)).resolves.toEqual(saved);
    expect(apiRequest).toHaveBeenLastCalledWith('/baggage/sync', expect.not.objectContaining({ headers: expect.anything() }), true);
  });
  it('rejects a late acknowledgement after the screen leaves', async () => {
    const controller = new AbortController();
    let resolve!: (value: typeof saved) => void;
    vi.mocked(apiRequest).mockReturnValue(new Promise((done) => { resolve = done; }));
    const request = acknowledgePhysicalSync(verified as never, bag, controller.signal);
    controller.abort();
    resolve(saved);
    await expect(request).rejects.toThrow('left');
  });
  it('does not start saving for a departed screen', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(acknowledgePhysicalSync(verified as never, bag, controller.signal)).rejects.toThrow('left');
    expect(apiRequest).not.toHaveBeenCalled();
  });
  it('propagates transport failure for API-only retry', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('offline'));
    await expect(acknowledgePhysicalSync(verified as never, bag)).rejects.toThrow('offline');
  });
});
describe('server-owned payload', () => {
  it('uses exact server identifiers', () => {
    expect(buildOwnedBagPayload(bag)).toMatchObject({ tagUid: bag.tag_code, baggageTagNumber: bag.tag_number, departureDate: '2026-11-21', barcodeSymbology: 'INTERLEAVED_2_OF_5' });
  });
  it.each([{ ...bag, tag_number: 'SEED-TAG' }, { ...bag, tag_code: 'SEED-TAG' }, { ...bag, departure_time: 'invalid' }])('rejects incomplete server hardware identity', (row) => expect(() => buildOwnedBagPayload(row)).toThrow());
});

const trip = { booking_id: 'booking-1', pnr: bag.booking_reference, flight_number: bag.flight_number, origin_code: 'HKG', destination_code: 'NRT', departure_time: bag.departure_time };
const prepared = { booking_id: trip.booking_id, pnr: trip.pnr, ready: true, tag_id: bag.tag_id };
describe('live booking ownership selection', () => {
  it('selects only prepared bound tag on exact live trip', () => {
    expect(selectOwnedSyncBag([{ ...bag, tag_id: 'other' }, bag], prepared as never, trip as never)).toEqual(bag);
  });
  it.each([[], [bag, bag], [{ ...bag, tag_id: 'other' }], [{ ...bag, departure_time: '2026-11-22T10:00:00Z' }], [{ ...bag, booking_reference: 'OTHER' }], [{ ...bag, tag_id: undefined }]].map((rows) => ({ rows })))('rejects missing, ambiguous, stale or old-server identity', ({ rows }) => {
    expect(() => selectOwnedSyncBag(rows as never, prepared as never, trip as never)).toThrow();
  });
  it.each([{ ...prepared, ready: false }, { ...prepared, booking_id: 'OTHER' }, { ...prepared, tag_id: null }])('rejects incomplete preparation', (value) => {
    expect(() => selectOwnedSyncBag([bag], value as never, trip as never)).toThrow();
  });
});
