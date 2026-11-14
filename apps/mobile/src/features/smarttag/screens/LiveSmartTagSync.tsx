import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { INfcService, NfcCancelledError, NfcSyncOutcome, runSmartTagSync } from '@polyaero/shared';
import { apiRequest, prepareSmartTag, TripCard } from '../../../services/api';
import { getPhysicalNfcService } from '../../../services/nfc';
import { acknowledgePhysicalSync, buildOwnedBagPayload, OwnedSyncBag, selectOwnedSyncBag } from '../../../services/smartTagSync';
import { CathayPrimaryButton, InlineNotice } from '../components/CathaySmartTagPrimitives';

export function LiveSmartTagSync({ trip }: { trip: TripCard }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [pending, setPending] = useState<{ outcome: NfcSyncOutcome; bag: OwnedSyncBag } | null>(null);
  const operation = useRef<{ cancelled: boolean; service: INfcService | null } | null>(null);
  useEffect(() => () => {
    if (operation.current) {
      operation.current.cancelled = true;
      void operation.current.service?.cancelScan().catch(() => {});
    }
  }, []);

  const sync = async () => {
    if (operation.current || complete) return;
    const current = { cancelled: false, service: null as INfcService | null };
    operation.current = current;
    setBusy(true);
    setError(null);
    let verified = pending;
    try {
      if (!verified) {
        setMessage('Checking your live booking and bound SmartTag…');
        const prepared = await prepareSmartTag(trip.booking_id);
        const rows = await apiRequest<OwnedSyncBag[]>('/baggage', {}, true);
        const bag = selectOwnedSyncBag(rows, prepared, trip);
        const payload = buildOwnedBagPayload(bag);
        const service = getPhysicalNfcService();
        if (!service) throw new Error('Physical NFC requires a supported native phone build. No demo write was performed.');
        if (current.cancelled) return;
        current.service = service;
        const outcome = await runSmartTagSync({
          mode: 'PHYSICAL_HARDWARE', service, payload, expectedTagUid: bag.tag_code, stepDelayMs: 0,
          onStep: (step) => {
            if (current.cancelled) throw new NfcCancelledError();
            setMessage(step.state === 'SUCCESS' ? 'Display verified; waiting for server confirmation…' : step.statusMessage);
          },
        });
        if (current.cancelled) return;
        if (outcome.finalState !== 'SUCCESS') throw new Error(outcome.failure?.message || 'Physical SmartTag write was not verified.');
        verified = { outcome, bag };
        setPending(verified);
      }
      if (current.cancelled) return;
      setMessage('Display verified; saving sync to your booking…');
      await acknowledgePhysicalSync(verified.outcome, verified.bag);
      if (current.cancelled) return;
      setPending(null);
      setComplete(true);
      setMessage('Physical SmartTag write verified and saved to shared baggage records. Connected staff dashboards refresh automatically.');
    } catch (failure) {
      if (!current.cancelled) {
        setError(failure instanceof Error ? failure.message : 'SmartTag synchronization failed.');
        setMessage(null);
      }
    } finally {
      if (!current.cancelled) setBusy(false);
      if (operation.current === current) operation.current = null;
    }
  };

  // ponytail: verified retry stays in memory; leaving this screen requires a new tap.
  return (
    <View accessibilityLiveRegion="polite">
      {(message || error || pending) && <InlineNotice
        tone={error || pending ? 'warning' : 'info'}
        title={pending ? 'Display updated; server confirmation pending' : complete ? 'SmartTag sync saved' : 'Physical SmartTag sync'}
        message={error || message || 'Retry saving without tapping again.'}
      />}
      <CathayPrimaryButton label={busy ? 'Sync in progress…' : pending ? 'Retry saving (no NFC tap)' : complete ? 'SmartTag sync saved' : 'Tap and sync SmartTag'}
        disabled={busy || complete} onPress={() => void sync()} testID={`live-smarttag-sync-${trip.booking_id}`} />
    </View>
  );
}
