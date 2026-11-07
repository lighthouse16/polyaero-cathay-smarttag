import React, { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
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
    smartTagController.navigateTo(resolved, { itineraryId: itin.id, replace: true });
  }, [step]);

  return <CathayAppShell initialTabOverride="trips" />;
}
