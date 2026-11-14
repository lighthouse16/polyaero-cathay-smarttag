import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

const member = {
  id: 'member-1',
  title: 'Mx',
  family_name: 'SEED',
  given_names: 'DEMO',
  email: 'seed@example.com',
  country_code: null,
  phone_number: null,
  membership_number: '9900000001',
  membership_tier: 'GOLD',
  status_points: 800,
  created_at: '2026-01-01T00:00:00Z',
};
const pair = { access_token: 'test-access', refresh_token: 'test-refresh' };
const reply = (body: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('EXPO_PUBLIC_API_URL', 'http://192.0.2.10:8123/api/v1/');
  vi.stubEnv('EXPO_PUBLIC_USE_MOCK_DATA', 'false');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function signedIn() {
  const api = await import('../api');
  fetchMock
    .mockResolvedValueOnce(reply(pair))
    .mockResolvedValueOnce(reply(member));
  await api.signIn('seed@example.com', 'TestPassword!42');
  fetchMock.mockClear();
  return api;
}

it('authenticates baggage sync and sends confirmation separately from flight defaults', async () => {
  await signedIn();
  const bridge = await import('../copilotBridge');
  fetchMock.mockResolvedValueOnce(
    reply({ tag_number: 'DB:TAG', tag_code: 'DB-UID' }),
  );
  expect(
    await bridge.syncBookingToCopilot({
      flightId: 'flight-id',
      flightNumber: 'CX123',
      origin: 'HKG',
      destination: 'NRT',
      initialStatus: 'TAGGED',
    }),
  ).not.toBeNull();
  const request = fetchMock.mock.calls[0][1];
  expect(request.headers.get('Authorization')).toBe('Bearer test-access');
  const body = JSON.parse(request.body);
  expect(body.flight_id).toBe('flight-id');
  expect(body.sync_status).toBe('TAGGED');
  expect(body).not.toHaveProperty('initial_status');
  expect(body).not.toHaveProperty('weather_severity');
  expect(bridge.getActivePassengerTag()).toBe('DB:TAG');
  fetchMock.mockResolvedValueOnce(reply({ tag_number: 'DB:TAG' }));
  await bridge.fetchLiveCopilotBag();
  expect(fetchMock.mock.calls[1][0]).toMatch(/\/baggage\/DB%3ATAG$/);
  expect(fetchMock.mock.calls[1][1].headers.get('Authorization')).toBe(
    'Bearer test-access',
  );
});

describe('mobile API configuration and authentication', () => {
  it('normalizes the URL and shares it with baggage/NFC calls', async () => {
    const config = await import('../apiConfig');
    const bridge = await import('../copilotBridge');
    expect(config.API_BASE_URL).toBe('http://192.0.2.10:8123/api/v1');
    expect(config.USE_MOCK_DATA).toBe(false);
    expect(bridge.COPILOT_API_BASE).toBe(config.API_BASE_URL);
  });

  it('uses emulator defaults and requires an explicit demo flag', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_URL', '');
    vi.stubEnv('EXPO_PUBLIC_USE_MOCK_DATA', '');
    expect((await import('../apiConfig')).API_BASE_URL).toBe(
      'http://10.0.2.2:8000/api/v1',
    );
    expect((await import('../apiConfig')).USE_MOCK_DATA).toBe(false);
  });

  it('supports HTTPS production URLs without hardcoded hosts', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://api.example.com/api/v1');
    expect((await import('../apiConfig')).API_BASE_URL).toBe(
      'https://api.example.com/api/v1',
    );
  });

  it.each([
    'ftp://example.com',
    'https://user:password@example.com',
    'https://example.com?key=test',
  ])('rejects unsafe API configuration: %s', async (url) => {
    vi.stubEnv('EXPO_PUBLIC_API_URL', url);
    await expect(import('../apiConfig')).rejects.toThrow('EXPO_PUBLIC_API_URL');
  });

  it('fetches the authenticated profile rather than fabricating a member', async () => {
    const api = await signedIn();
    expect(api.hasSession()).toBe(true);
    expect(api.userProfile(member)).toMatchObject({
      title: 'Mx',
      familyName: 'SEED',
      givenName: 'DEMO',
      tierStatus: 'Gold',
      statusPoints: 800,
      asiaMiles: null,
      pointsToNextTier: null,
    });
  });

  it('does not log in when the backend rejects credentials', async () => {
    const api = await import('../api');
    fetchMock.mockResolvedValue(reply({ detail: 'Invalid credentials' }, 401));
    await expect(api.signIn('seed@example.com', 'wrong')).rejects.toThrow(
      'Invalid credentials',
    );
    expect(api.hasSession()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requires OTP verification before starting a session', async () => {
    const api = await import('../api');
    fetchMock.mockResolvedValueOnce(
      reply({
        otp_required: true,
        challenge_id: 'challenge-1',
        channel: 'email',
      }),
    );
    expect(await api.signIn('seed@example.com', '')).toMatchObject({
      otp_required: true,
    });
    expect(api.hasSession()).toBe(false);
    fetchMock
      .mockResolvedValueOnce(reply(pair))
      .mockResolvedValueOnce(reply(member));
    expect(await api.verifySignIn('challenge-1', '123456')).toEqual(member);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      challenge_id: 'challenge-1',
      code: '123456',
    });
  });

  it('refreshes an expired access token once and retries with the new token', async () => {
    const api = await signedIn();
    fetchMock
      .mockResolvedValueOnce(reply({ detail: 'Expired' }, 401))
      .mockResolvedValueOnce(
        reply({ access_token: 'new-access', refresh_token: 'new-refresh' }),
      )
      .mockResolvedValueOnce(reply([]));
    expect(await api.listTrips('PAST')).toEqual([]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      refresh_token: 'test-refresh',
    });
    expect(fetchMock.mock.calls[2][1].headers.get('Authorization')).toBe(
      'Bearer new-access',
    );
  });

  it('shares a single token refresh across simultaneous protected requests', async () => {
    const api = await signedIn();
    fetchMock.mockImplementation((url, init) => {
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(
          reply({ access_token: 'new-access', refresh_token: 'new-refresh' }),
        );
      }
      return Promise.resolve(
        init.headers.get('Authorization') === 'Bearer test-access'
          ? reply({ detail: 'Expired' }, 401)
          : reply([]),
      );
    });
    expect(
      await Promise.all([api.listTrips('UPCOMING'), api.listTrips('PAST')]),
    ).toEqual([[], []]);
    expect(
      fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/refresh')),
    ).toHaveLength(1);
  });

  it('does not restore a session when a pending refresh completes after logout', async () => {
    const api = await signedIn();
    let complete!: (value: Response) => void;
    fetchMock
      .mockResolvedValueOnce(reply({ detail: 'Expired' }, 401))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            complete = resolve;
          }),
      )
      .mockResolvedValueOnce(reply(null, 204));
    const pending = api.listTrips('UPCOMING');
    const failure = expect(pending).rejects.toThrow('Session changed');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await api.signOut();
    complete(
      reply({ access_token: 'new-access', refresh_token: 'new-refresh' }),
    );
    await failure;
    expect(api.hasSession()).toBe(false);
  });

  it('clears revoked sessions and blocks protected requests without a login', async () => {
    const api = await signedIn();
    fetchMock.mockImplementation(() =>
      Promise.resolve(reply({ detail: 'Revoked' }, 401)),
    );
    await expect(api.listTrips('UPCOMING')).rejects.toThrow('Revoked');
    expect(api.hasSession()).toBe(false);
    fetchMock.mockClear();
    await expect(api.listTrips('UPCOMING')).rejects.toThrow('Please sign in');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears local tokens even when server logout fails', async () => {
    const api = await signedIn();
    fetchMock.mockRejectedValue(new TypeError('Network down'));
    await expect(api.signOut()).rejects.toThrow('Cannot reach the API');
    expect(api.hasSession()).toBe(false);
  });

  it('times out unreachable requests rather than leaving the UI loading forever', async () => {
    vi.useFakeTimers();
    const api = await import('../api');
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(new Error('Aborted')),
          );
        }),
    );
    const failure = expect(
      api.searchFlights('HKG', 'NRT', '2026-11-15', 'ECONOMY'),
    ).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(15000);
    await failure;
  });
});

it('sends backend flight IDs, booking references and trip-tab values exactly', async () => {
  const api = await signedIn();
  fetchMock.mockImplementation(() => Promise.resolve(reply({ outbound: [] })));
  await api.searchFlights('hkg', 'nrt', '2026-11-15', 'BUSINESS');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
    origin: 'HKG',
    destination: 'NRT',
    departure_date: '2026-11-15',
    cabin_class: 'BUSINESS',
    trip_type: 'ONE_WAY',
  });
  await api.createBooking('actual-flight-id', ' sd0001 ', 'BUSINESS');
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
    flight_id: 'actual-flight-id',
    pnr: 'SD0001',
    cabin_class: 'BUSINESS',
  });
  expect(fetchMock.mock.calls[1][1].headers.get('Authorization')).toBe(
    'Bearer test-access',
  );
  await api.listTrips('CANCELLED');
  expect(fetchMock.mock.calls[2][0]).toMatch(/\/trips\?tab=CANCELLED$/);
  await api.addTrip(' sd0001 ', ' SEED ');
  expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({
    pnr: 'SD0001',
    last_name: 'SEED',
  });
});

it('surfaces validation errors and never turns a failed booking into success', async () => {
  const api = await signedIn();
  fetchMock.mockResolvedValueOnce(
    reply({ detail: [{ msg: 'Invalid flight ID' }] }, 422),
  );
  await expect(
    api.createBooking('bad-id', 'SD0001', 'ECONOMY'),
  ).rejects.toThrow('Invalid flight ID');
  fetchMock.mockResolvedValueOnce(
    reply({ detail: 'Booking reference already exists' }, 409),
  );
  await expect(
    api.createBooking('flight-id', 'SD0001', 'ECONOMY'),
  ).rejects.toThrow('already exists');
});

it('looks up staff-reported status by flight number and UTC date', async () => {
  const api = await import('../api');
  fetchMock.mockResolvedValueOnce(reply([]));
  expect(await api.getFlightStatus(' cx255 ', '2026-11-14')).toEqual([]);
  expect(fetchMock.mock.calls[0][0]).toMatch(
    /\/flights\/status\?flight_number=CX255&departure_date=2026-11-14$/,
  );
});

it('requires authentication for boarding passes and surfaces ineligible bookings', async () => {
  const api = await import('../api');
  await expect(api.getBoardingPass('booking-id')).rejects.toThrow(
    'Please sign in',
  );
  expect(fetchMock).not.toHaveBeenCalled();
  await signedIn();
  fetchMock.mockResolvedValueOnce(
    reply({ detail: 'An upcoming checked-in booking is required' }, 409),
  );
  await expect(api.getBoardingPass('booking-id')).rejects.toThrow(
    'checked-in booking',
  );
  expect(fetchMock.mock.calls[0][0]).toMatch(
    /\/bookings\/booking-id\/boarding-pass$/,
  );
  expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe(
    'Bearer test-access',
  );
});
