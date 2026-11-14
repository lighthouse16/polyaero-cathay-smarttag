import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  addTrip,
  ApiError,
  CabinClass,
  createBooking,
  FlightOption,
  hasSession,
  listTrips,
  prepareSmartTag,
  searchFlights,
  TripCard,
  TripStatus,
} from "../../services/api";

const cabins: CabinClass[] = [
  "ECONOMY",
  "PREMIUM_ECONOMY",
  "BUSINESS",
  "FIRST",
];
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Request failed.";
const flightTime = (value: string) => new Date(value).toLocaleString();

export function LiveBookScreen({
  onBooked,
  onOpenSignIn,
}: {
  onBooked: () => void;
  onOpenSignIn: () => void;
}) {
  const [origin, setOrigin] = useState("HKG");
  const [destination, setDestination] = useState("NKG");
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [cabin, setCabin] = useState<CabinClass>("ECONOMY");
  const [flights, setFlights] = useState<FlightOption[] | null>(null);
  const [selected, setSelected] = useState<FlightOption | null>(null);
  const [pnr, setPnr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (busy) return;
    if (
      !/^[A-Z]{3}$/.test(origin) ||
      !/^[A-Z]{3}$/.test(destination) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(day)
    ) {
      setError(
        "Enter three-letter airport codes and a date in YYYY-MM-DD format.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    setFlights(null);
    setSelected(null);
    try {
      const result = await searchFlights(origin, destination, day, cabin);
      setFlights(result.outbound);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const book = async () => {
    if (busy || !selected) return;
    if (!hasSession()) {
      onOpenSignIn();
      return;
    }
    if (!/^[A-Z0-9]{5,10}$/.test(pnr.trim().toUpperCase())) {
      setError(
        "Enter a 5-10 character booking reference (letters and numbers).",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createBooking(selected.id, pnr, cabin);
      onBooked();
    } catch (failure) {
      setError(errorMessage(failure));
      if (failure instanceof ApiError && failure.status === 401) onOpenSignIn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Book flights</Text>
        <Text style={styles.secondary}>
          Add one flight at a time. Search dates use UTC.
        </Text>
        <Text style={styles.label}>From (airport code)</Text>
        <TextInput
          style={styles.input}
          value={origin}
          onChangeText={(value) => setOrigin(value.toUpperCase())}
          autoCapitalize="characters"
          maxLength={3}
          editable={!busy}
        />
        <Text style={styles.label}>To (airport code)</Text>
        <TextInput
          style={styles.input}
          value={destination}
          onChangeText={(value) => setDestination(value.toUpperCase())}
          autoCapitalize="characters"
          maxLength={3}
          editable={!busy}
        />
        <Text style={styles.label}>Departure date (YYYY-MM-DD, UTC)</Text>
        <TextInput
          style={styles.input}
          value={day}
          onChangeText={setDay}
          editable={!busy}
        />
        <Text style={styles.label}>Cabin</Text>
        <View style={styles.tabs}>
          {cabins.map((value) => (
            <TouchableOpacity
              key={value}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ selected: cabin === value }}
              onPress={() => {
                setCabin(value);
                setSelected(null);
              }}
              style={[styles.tab, cabin === value && styles.activeTab]}
            >
              <Text>{value.replace(/_/g, " ")}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={styles.button}
          disabled={busy}
          onPress={search}
        >
          <Text style={styles.buttonText}>Search flights</Text>
        </TouchableOpacity>
        {busy && <ActivityIndicator color="#006564" />}
        {error && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}
        {flights?.length === 0 && (
          <Text style={styles.secondary}>
            No flights found for this route and date.
          </Text>
        )}
        {flights?.map((flight) => {
          const availability = flight.cabins[cabin];
          const available = !!availability && availability.seats_available > 0;
          return (
            <TouchableOpacity
              key={flight.id}
              disabled={busy || !available}
              accessibilityRole="button"
              accessibilityState={{
                selected: selected?.id === flight.id,
                disabled: !available,
              }}
              onPress={() => setSelected(flight)}
              style={[
                styles.card,
                selected?.id === flight.id && styles.selectedCard,
              ]}
            >
              <Text style={styles.heading}>
                {flight.flight_number} · {flight.origin_code} →{" "}
                {flight.destination_code}
              </Text>
              <Text>
                {flightTime(flight.departure_time)} →{" "}
                {flightTime(flight.arrival_time)}
              </Text>
              <Text>{flight.aircraft || "Aircraft not assigned"}</Text>
              <Text>
                {available
                  ? `HKD ${availability.price.toLocaleString()} · ${availability.seats_available} seats available`
                  : "Cabin unavailable"}
              </Text>
            </TouchableOpacity>
          );
        })}
        {selected && (
          <>
            <Text style={styles.label}>Booking reference</Text>
            <Text style={styles.secondary}>
              This prototype creates a reservation only; it does not take
              payment or issue a ticket.
            </Text>
            <TextInput
              style={styles.input}
              value={pnr}
              onChangeText={setPnr}
              autoCapitalize="characters"
              maxLength={10}
              editable={!busy}
              placeholder="5–10 letters/numbers"
            />
            <TouchableOpacity
              style={styles.button}
              disabled={busy}
              onPress={book}
            >
              <Text style={styles.buttonText}>Create booking</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function LiveTripsScreen({
  onOpenSignIn,
  surname,
}: {
  onOpenSignIn: () => void;
  surname: string;
}) {
  const [tab, setTab] = useState<TripStatus>("UPCOMING");
  const [trips, setTrips] = useState<TripCard[]>([]);
  const [busy, setBusy] = useState(hasSession());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pnr, setPnr] = useState("");
  const [lastName, setLastName] = useState(surname);
  const requestId = useRef(0);

  const load = useCallback(() => {
    const id = ++requestId.current;
    if (!hasSession()) return;
    return listTrips(tab).then(
      (result) => {
        if (id === requestId.current) {
          setTrips(result);
          setBusy(false);
        }
      },
      (failure) => {
        if (id === requestId.current) {
          setError(errorMessage(failure));
          setBusy(false);
        }
      },
    );
  }, [tab]);
  const cancelLoad = useCallback(() => {
    requestId.current++;
  }, []);

  useEffect(() => {
    void load();
    return cancelLoad;
  }, [load, cancelLoad]);

  const reload = () => {
    setBusy(hasSession());
    setError(null);
    void load();
  };

  const importBooking = async () => {
    if (adding) return;
    if (!hasSession()) {
      onOpenSignIn();
      return;
    }
    if (
      !/^[A-Z0-9]{5,10}$/.test(pnr.trim().toUpperCase()) ||
      !lastName.trim()
    ) {
      setError("Enter a valid booking reference and passenger surname.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const imported = await addTrip(pnr, lastName);
      setPnr("");
      if (imported.booking_status !== tab) {
        setTrips([]);
        setBusy(true);
        setTab(imported.booking_status);
      } else await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setAdding(false);
    }
  };

  const showPreparation = async (trip: TripCard) => {
    try {
      const prepared = await prepareSmartTag(trip.booking_id);
      Alert.alert(
        "SmartTag preparation",
        `Booking ${prepared.pnr}\nCheck-in: ${prepared.demo_checkin_completed ? "Complete" : "Required"}\n` +
          `Tag: ${prepared.smarttag_available ? "Bound" : "Not bound"}\nSync: ${prepared.sync_state || "Not prepared"}\n\n` +
          "The prototype NFC setup screens are not yet connected to live booking IDs.",
      );
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={busy} onRefresh={reload} />}
      >
        <Text style={styles.title}>My trips</Text>
        <View style={styles.tabs}>
          {(["UPCOMING", "PAST", "CANCELLED"] as const).map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => {
                if (tab === value) return;
                setTrips([]);
                setError(null);
                setBusy(hasSession());
                setTab(value);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === value }}
              style={[styles.tab, tab === value && styles.activeTab]}
            >
              <Text>{value}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {!hasSession() && (
          <TouchableOpacity style={styles.button} onPress={onOpenSignIn}>
            <Text style={styles.buttonText}>Sign in to view your trips</Text>
          </TouchableOpacity>
        )}
        {error && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}
        {hasSession() && !busy && !error && trips.length === 0 && (
          <Text style={styles.secondary}>
            You have no {tab.toLowerCase()} bookings.
          </Text>
        )}
        {trips.map((trip) => (
          <View key={trip.booking_id} style={styles.card}>
            <Text style={styles.heading}>
              {trip.flight_number} · {trip.origin_code} →{" "}
              {trip.destination_code}
            </Text>
            <Text>Booking reference {trip.pnr}</Text>
            <Text>
              {flightTime(trip.departure_time)} →{" "}
              {flightTime(trip.arrival_time)}
            </Text>
            <Text>
              Terminal {trip.terminal || "not assigned"} · Gate{" "}
              {trip.gate || "not assigned"}
            </Text>
            <Text>
              {trip.checkin_status ? "Checked in" : "Check-in required"} ·{" "}
              {trip.selected_bags}/{trip.allowed_bags} bags
            </Text>
            {tab === "UPCOMING" && (
              <TouchableOpacity
                style={styles.button}
                onPress={() => showPreparation(trip)}
              >
                <Text style={styles.buttonText}>
                  Check SmartTag preparation
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {hasSession() && (
          <>
            <Text style={styles.heading}>Add booking</Text>
            <Text style={styles.label}>Booking reference</Text>
            <TextInput
              style={styles.input}
              value={pnr}
              onChangeText={setPnr}
              editable={!adding}
              autoCapitalize="characters"
              maxLength={10}
            />
            <Text style={styles.label}>Passenger surname</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              editable={!adding}
            />
            <TouchableOpacity
              style={styles.button}
              disabled={adding}
              onPress={importBooking}
            >
              <Text style={styles.buttonText}>
                {adding ? "Adding..." : "Add booking"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7F6" },
  content: { padding: 22, paddingBottom: 120, gap: 12 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#195A58",
    marginVertical: 16,
  },
  heading: { fontSize: 18, fontWeight: "600", color: "#195A58" },
  secondary: { color: "#4A5568", lineHeight: 22 },
  label: { fontSize: 14, fontWeight: "600", color: "#1C2024" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#CBD5E0",
    borderRadius: 8,
    padding: 14,
  },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: { padding: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: "#006564", backgroundColor: "#E8F0EE" },
  button: {
    backgroundColor: "#006564",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  card: {
    padding: 18,
    backgroundColor: "#fff",
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#DDE5E2",
  },
  selectedCard: { borderColor: "#006564", borderWidth: 2 },
  error: { color: "#B91C1C", lineHeight: 22 },
});
