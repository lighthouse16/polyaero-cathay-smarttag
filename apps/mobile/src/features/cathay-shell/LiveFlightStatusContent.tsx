import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FlightStatus, getFlightStatus } from '../../services/api';
import { JadeBookingTicketCard } from '../smarttag/components/CathaySmartTagPrimitives';

const utcTime = (value: string | null) =>
  value
    ? `${new Date(value).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC`
    : 'Not reported';

export function LiveFlightStatusContent() {
  const [number, setNumber] = useState('');
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [flights, setFlights] = useState<FlightStatus[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (busy) return;
    if (!number.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      setError('Enter a flight number and departure date (YYYY-MM-DD).');
      return;
    }
    setBusy(true);
    setError(null);
    setFlights(null);
    try {
      setFlights(await getFlightStatus(number, day));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Unable to load flight status.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text>
        Database status updated by staff. No live airline feed. Search dates and
        displayed times use UTC.
      </Text>
      <Text>Flight number</Text>
      <TextInput
        style={styles.input}
        value={number}
        onChangeText={setNumber}
        autoCapitalize="characters"
        maxLength={10}
        placeholder="e.g. CX255"
        editable={!busy}
      />
      <Text>Scheduled departure date (YYYY-MM-DD, UTC)</Text>
      <TextInput
        style={styles.input}
        value={day}
        onChangeText={setDay}
        editable={!busy}
      />
      <TouchableOpacity style={styles.button} onPress={search} disabled={busy}>
        <Text style={styles.buttonText}>Check status</Text>
      </TouchableOpacity>
      {busy && <ActivityIndicator color="#006564" />}
      {error && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      {flights?.length === 0 && (
        <Text>No matching flights found for this number and date.</Text>
      )}
      {flights?.map((flight) => (
        <View key={flight.id} style={styles.card}>
          <JadeBookingTicketCard
            flightNumber={flight.flight_number}
            route={`${flight.origin} → ${flight.destination}`}
            dateStr={new Date(flight.departure_time).toLocaleDateString(
              'en-GB',
              { timeZone: 'UTC' },
            )}
            departureTime={`${new Date(flight.departure_time).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })} UTC`}
            terminal={flight.terminal || 'Not assigned'}
            gate={flight.gate || 'Not assigned'}
          />
          <Text style={styles.status}>Status: {flight.operational_status}</Text>
          <Text>Last staff update: {utcTime(flight.status_reported_at)}</Text>
          <Text>Scheduled departure: {utcTime(flight.departure_time)}</Text>
          <Text>Scheduled arrival: {utcTime(flight.arrival_time)}</Text>
          <Text>
            Estimated departure: {utcTime(flight.estimated_departure_time)}
          </Text>
          <Text>
            Estimated arrival: {utcTime(flight.estimated_arrival_time)}
          </Text>
          <Text>Actual departure: {utcTime(flight.actual_departure_time)}</Text>
          <Text>Actual arrival: {utcTime(flight.actual_arrival_time)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  input: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#CBD5E0',
    borderRadius: 8,
  },
  button: {
    padding: 15,
    backgroundColor: '#006564',
    alignItems: 'center',
    borderRadius: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  card: { gap: 10, marginVertical: 10 },
  status: { color: '#195A58', fontSize: 18, fontWeight: '600' },
  error: { color: '#B91C1C' },
});
