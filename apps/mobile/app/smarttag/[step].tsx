import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { DEFAULT_DECLARATIONS, buildNfcPayloadForBag } from '@polyaero/shared';
import { CathayAppShell } from '../../src/features/cathay-shell/CathayAppShell';
import { USE_MOCK_DATA } from '../../src/services/apiConfig';
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
    if (!USE_MOCK_DATA) return;
    let activeStep = step;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const stepParam = searchParams.get('step');
      if (stepParam) {
        activeStep = stepParam;
      }
    }

    const resolved: SmartTagScreenRoute =
      activeStep && VALID_STEPS.includes(activeStep as SmartTagScreenRoute)
        ? (activeStep as SmartTagScreenRoute)
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
          setupState: 'SIMULATED_WRITE_COMPLETED',
          mode: 'SIMULATED_DEMO',
          writeRecord: {
            mode: 'SIMULATED_DEMO',
            timestamp: new Date().toISOString(),
            bytesWritten: 4736,
            tagUid: bags[0].smartTag.tagUid,
            verifiedHardwareReadback: false,
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
