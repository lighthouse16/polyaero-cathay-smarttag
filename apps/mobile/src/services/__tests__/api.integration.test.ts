import { afterAll, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

const url = process.env.MOBILE_API_TEST_URL;
afterAll(() => vi.unstubAllEnvs());

it.skipIf(!url)(
  'signs in, searches, creates a booking, reads trip tabs, imports and logs out against real FastAPI',
  async () => {
    vi.stubEnv('EXPO_PUBLIC_API_URL', url!);
    vi.resetModules();
    const api = await import('../api');
    const password = process.env.MOBILE_API_TEST_PASSWORD;
    if (!password)
      throw new Error(
        'MOBILE_API_TEST_PASSWORD must match the isolated seed password.',
      );
    const member = await api.signIn('seed.passenger.1@example.com', password);
    expect(member).toMatchObject({ family_name: 'SEED1' });
    const today = new Date().toISOString().slice(0, 10);
    const flights = await api.searchFlights('HKG', 'NKG', today, 'ECONOMY');
    expect(flights.outbound.length).toBeGreaterThan(0);
    const pnr = `T${Date.now().toString().slice(-9)}`;
    const booking = await api.createBooking(
      flights.outbound[0].id,
      pnr,
      'ECONOMY',
    );
    const upcoming = await api.listTrips('UPCOMING');
    expect(upcoming.find((trip) => trip.booking_id === booking.id)?.pnr).toBe(
      pnr,
    );
    const statuses = await api.getFlightStatus('CX255', today);
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses[0].source).toBe('STAFF_REPORTED_DATABASE');
    const checkedIn = upcoming.find((trip) => trip.checkin_status);
    expect(checkedIn).toBeDefined();
    const pass = await api.getBoardingPass(checkedIn!.booking_id);
    expect(pass.valid_for_boarding).toBe(false);
    expect(pass.notice).toBe('PROTOTYPE - NOT VALID FOR BOARDING');
    await expect(api.getBoardingPass(booking.id)).rejects.toThrow(
      'checked-in booking',
    );
    const past = await api.listTrips('PAST');
    expect(past.length).toBeGreaterThan(0);
    expect(past.every((trip) => trip.booking_status === 'PAST')).toBe(true);
    expect(
      (await api.listTrips('CANCELLED')).every(
        (trip) => trip.booking_status === 'CANCELLED',
      ),
    ).toBe(true);
    expect((await api.addTrip(pnr, 'SEED1')).booking_id).toBe(booking.id);
    expect((await api.prepareSmartTag(booking.id)).ready).toBe(false);
    await api.signOut();
    expect(api.hasSession()).toBe(false);
  },
  30000,
);
