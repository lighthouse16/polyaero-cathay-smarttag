import React, { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { DEFAULT_DECLARATIONS, buildNfcPayloadForBag } from '@polyaero/shared';
import { CathayAppShell } from '../../src/features/cathay-shell/CathayAppShell';
import {
  SmartTagScreenRoute,
  smartTagController,
  smartTagRepository,
} from '../../src/features/smarttag/store';

const VALID_STEPS: SmartTagScreenRoute[] = [
  'bookings',
  'prepare',
  'sync',
  'result',
  'journey',
  'report',
];

export default function SmartTagStepRoute() {
  const { step } = useLocalSearchParams<{ step?: string }>();

  useEffect(() => {
    const resolved: SmartTagScreenRoute =
      step && VALID_STEPS.includes(step as SmartTagScreenRoute)
        ? (step as SmartTagScreenRoute)
        : 'bookings';
    const itin = smartTagRepository.addDemoItinerary();

    if (resolved !== 'bookings' && resolved !== 'prepare') {
      const { bags } = smartTagRepository.prepareBagsForItinerary({
        itineraryId: itin.id,
        bagCount: 1,
        declarations: DEFAULT_DECLARATIONS,
      });

      if (
        (resolved === 'result' || resolved === 'journey' || resolved === 'report') &&
        bags[0]
      ) {
        smartTagRepository.recordSyncOutcome(bags[0].id, {
          finalState: 'SUCCESS',
          setupState: 'PHYSICALLY_WRITTEN_AND_VERIFIED',
          mode: 'PHYSICAL_HARDWARE',
          writeRecord: {
            mode: 'PHYSICAL_HARDWARE',
            timestamp: new Date().toISOString(),
            bytesWritten: 4736,
            tagUid: bags[0].smartTag.tagUid,
            verifiedHardwareReadback: true,
          },
          failure: null,
          payload: buildNfcPayloadForBag(itin, bags[0]),
        });

        if (resolved === 'journey') {
          smartTagRepository.seedDemoJourneyMilestonePreset(
            bags[0].id,
            'ARRIVED_TOKYO'
          );
        }
      }
    }

    smartTagController.navigateTo(resolved, { itineraryId: itin.id, replace: true });
  }, [step]);

  return <CathayAppShell initialTabOverride="trips" />;
}
