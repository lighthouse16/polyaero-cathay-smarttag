import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CATHAY_JADE, CATHAY_TEXT_PRIMARY, CATHAY_TEXT_MUTED } from './CathaySmartTagPrimitives';

export type SmartTagStep = 'prepare' | 'sync' | 'ready';

interface SmartTagStepperProps {
  currentStep: SmartTagStep;
}

export const SmartTagStepper: React.FC<SmartTagStepperProps> = ({ currentStep }) => {
  const isStep1Done = currentStep === 'sync' || currentStep === 'ready';
  const isStep1Active = currentStep === 'prepare';

  const isStep2Done = currentStep === 'ready';
  const isStep2Active = currentStep === 'sync';

  const isStep3Done = currentStep === 'ready';
  const isStep3Active = currentStep === 'ready';

  return (
    <View style={styles.container}>
      {/* Node 1: Prepare */}
      <View style={styles.stepItem}>
        <View style={[styles.circle, (isStep1Done || isStep1Active) && styles.circleActive]}>
          {isStep1Done ? (
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          ) : (
            <View style={styles.innerDot} />
          )}
        </View>
        <Text style={[styles.label, isStep1Active && styles.labelActive]}>Prepare</Text>
      </View>

      {/* Line 1 -> 2 */}
      <View style={[styles.line, (isStep1Done || isStep2Active || isStep2Done) && styles.lineActive]} />

      {/* Node 2: Sync */}
      <View style={styles.stepItem}>
        {isStep2Active ? (
          <View style={styles.haloRing}>
            <View style={[styles.circle, styles.circleActive]}>
              <View style={styles.innerDot} />
            </View>
          </View>
        ) : (
          <View style={[styles.circle, isStep2Done && styles.circleActive]}>
            {isStep2Done ? (
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            ) : null}
          </View>
        )}
        <Text style={[styles.label, isStep2Active && styles.labelActive]}>Sync</Text>
      </View>

      {/* Line 2 -> 3 */}
      <View style={[styles.line, isStep3Done && styles.lineActive]} />

      {/* Node 3: Ready */}
      <View style={styles.stepItem}>
        <View style={[styles.circle, isStep3Active && styles.circleActive]}>
          {isStep3Done ? (
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          ) : null}
        </View>
        <Text style={[styles.label, isStep3Active && styles.labelActive]}>Ready</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  stepItem: {
    alignItems: 'center',
    width: 64,
    paddingTop: 3,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#C5C9CD',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    borderColor: CATHAY_JADE,
    backgroundColor: CATHAY_JADE,
  },
  haloRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D7EBE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E6E8',
    marginHorizontal: 4,
    marginTop: 13,
  },
  lineActive: {
    backgroundColor: CATHAY_JADE,
  },
  label: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    color: CATHAY_TEXT_MUTED,
  },
  labelActive: {
    fontWeight: '700',
    color: CATHAY_TEXT_PRIMARY,
  },
});
