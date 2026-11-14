import type { UserAuthProfile } from "../features/cathay-shell/CathayTypes";
import { API_BASE_URL } from "./apiConfig";

interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export interface ApiUser {
  id: string;
  title: string | null;
  family_name: string | null;
  given_names: string | null;
  email: string;
  country_code: string | null;
  phone_number: string | null;
  membership_number: string | null;
  membership_tier: string;
  status_points: number;
  created_at: string;
}

export interface SignInResponse {
  otp_required: boolean;
  challenge_id: string | null;
  channel: string | null;
  access_token: string | null;
  refresh_token: string | null;
}

export type CabinClass = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
export type TripStatus = "UPCOMING" | "PAST" | "CANCELLED";

export interface FlightOption {
  id: string;
  flight_number: string;
  origin_code: string;
  destination_code: string;
  departure_time: string;
  arrival_time: string;
  terminal: string | null;
  gate: string | null;
  aircraft: string | null;
  is_connecting: boolean;
  cabins: Partial<
    Record<CabinClass, { seats_available: number; price: number }>
  >;
}

export interface TripCard {
  booking_id: string;
  pnr: string;
  flight_number: string;
  origin_code: string;
  destination_code: string;
  departure_time: string;
  arrival_time: string;
  terminal: string | null;
  gate: string | null;
  booking_status: TripStatus;
  checkin_status: boolean;
  allowed_bags: number;
  selected_bags: number;
  smarttag_ready: boolean;
}

export interface Booking {
  id: string;
  pnr: string;
  flight_id: string;
  cabin_class: CabinClass;
  booking_status: TripStatus;
  checkin_status: boolean;
}

export interface SmartTagPreparation {
  booking_id: string;
  pnr: string;
  ready: boolean;
  smarttag_available: boolean;
  demo_checkin_completed: boolean;
  sync_state: string | null;
  tag_id: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Session tokens stay in memory, never in public env files or unencrypted storage.
let tokens: TokenPair | null = null;
let refreshInFlight: Promise<void> | null = null;
let sessionVersion = 0;

export function clearSession(): void {
  tokens = null;
  sessionVersion++;
}

export function hasSession(): boolean {
  return tokens !== null;
}

async function send<T>(
  path: string,
  init: RequestInit,
  token?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const headers = new Headers(init.headers);
    if (init.body) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      let message = `API request failed (${response.status})`;
      try {
        const body = await response.json();
        if (typeof body.detail === "string") message = body.detail;
        else if (Array.isArray(body.detail)) {
          message = body.detail
            .map((item: { msg?: string }) => item.msg || "Invalid input")
            .join("; ");
        }
      } catch {
        // Proxies can return non-JSON errors.
      }
      throw new ApiError(message, response.status);
    }
    return response.status === 204
      ? (undefined as T)
      : ((await response.json()) as T);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      controller.signal.aborted
        ? "The API request timed out. Please try again."
        : "Cannot reach the API. Check the API URL, network, and server.",
      0,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshSession(): Promise<void> {
  if (refreshInFlight) return refreshInFlight;
  const current = tokens;
  const version = sessionVersion;
  if (!current) throw new ApiError("Please sign in again.", 401);
  const refresh = send<TokenPair>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: current.refresh_token }),
  })
    .then((next) => {
      if (sessionVersion !== version)
        throw new ApiError("Session changed. Please sign in again.", 401);
      tokens = next;
    })
    .catch((error) => {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        sessionVersion === version
      )
        clearSession();
      throw error;
    })
    .finally(() => {
      if (refreshInFlight === refresh) refreshInFlight = null;
    });
  refreshInFlight = refresh;
  return refresh;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  authenticated = false,
): Promise<T> {
  if (authenticated && !tokens)
    throw new ApiError("Please sign in to continue.", 401);
  const version = sessionVersion;
  const accessToken = tokens?.access_token;
  try {
    return await send<T>(path, init, accessToken);
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      error.status !== 401 ||
      !authenticated ||
      version !== sessionVersion
    ) {
      throw error;
    }
    if (tokens?.access_token === accessToken) await refreshSession();
    try {
      return await send<T>(path, init, tokens?.access_token);
    } catch (failure) {
      if (
        failure instanceof ApiError &&
        failure.status === 401 &&
        version === sessionVersion
      )
        clearSession();
      throw failure;
    }
  }
}

async function startSession(pair: TokenPair): Promise<ApiUser> {
  if (!pair.access_token || !pair.refresh_token)
    throw new ApiError("Invalid authentication response.", 502);
  clearSession();
  tokens = pair;
  try {
    return await apiRequest<ApiUser>("/auth/me", {}, true);
  } catch (error) {
    clearSession();
    throw error;
  }
}

export async function signIn(
  identifier: string,
  password: string,
): Promise<ApiUser | SignInResponse> {
  const result = await apiRequest<SignInResponse>("/auth/signin", {
    method: "POST",
    body: JSON.stringify({
      identifier: identifier.trim(),
      password: password || undefined,
    }),
  });
  if (result.otp_required) return result;
  if (!result.access_token || !result.refresh_token)
    throw new ApiError("Invalid sign-in response.", 502);
  return startSession({
    access_token: result.access_token,
    refresh_token: result.refresh_token,
  });
}

export async function verifySignIn(
  challengeId: string,
  code: string,
): Promise<ApiUser> {
  const result = await apiRequest<TokenPair>("/auth/signin/verify", {
    method: "POST",
    body: JSON.stringify({ challenge_id: challengeId, code: code.trim() }),
  });
  return startSession(result);
}

export async function signOut(): Promise<void> {
  const current = tokens;
  clearSession();
  if (current)
    await send<void>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    });
}

export function userProfile(user: ApiUser): UserAuthProfile {
  const tiers: Record<string, UserAuthProfile["tierStatus"]> = {
    GREEN: "Green",
    SILVER: "Silver",
    GOLD: "Gold",
    DIAMOND: "Diamond",
  };
  return {
    isLoggedIn: true,
    title: user.title || "",
    familyName: user.family_name || "",
    givenName: user.given_names || "",
    email: user.email,
    mobile: `${user.country_code || ""} ${user.phone_number || ""}`.trim(),
    membershipNumber: user.membership_number || "",
    tierStatus: tiers[user.membership_tier] || "Green",
    memberSince: String(new Date(user.created_at).getFullYear()),
    statusPoints: user.status_points,
    asiaMiles: null,
    pointsToNextTier: null,
  };
}

export function searchFlights(
  origin: string,
  destination: string,
  day: string,
  cabin: CabinClass,
) {
  return apiRequest<{ outbound: FlightOption[] }>("/flights/search", {
    method: "POST",
    body: JSON.stringify({
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      departure_date: day,
      trip_type: "ONE_WAY",
      cabin_class: cabin,
      passenger_count: 1,
    }),
  });
}

export function createBooking(
  flightId: string,
  pnr: string,
  cabin: CabinClass,
) {
  return apiRequest<Booking>(
    "/bookings",
    {
      method: "POST",
      body: JSON.stringify({
        flight_id: flightId,
        pnr: pnr.trim().toUpperCase(),
        cabin_class: cabin,
      }),
    },
    true,
  );
}

export function listTrips(tab: TripStatus) {
  return apiRequest<TripCard[]>(`/trips?tab=${tab}`, {}, true);
}

export function addTrip(pnr: string, lastName: string) {
  return apiRequest<TripCard>(
    "/trips/add",
    {
      method: "POST",
      body: JSON.stringify({
        pnr: pnr.trim().toUpperCase(),
        last_name: lastName.trim(),
      }),
    },
    true,
  );
}

export function prepareSmartTag(bookingId: string) {
  return apiRequest<SmartTagPreparation>(
    `/smarttag/prepare/${encodeURIComponent(bookingId)}`,
    {},
    true,
  );
}
