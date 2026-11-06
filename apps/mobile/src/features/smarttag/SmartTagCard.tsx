import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radii, typography, shadows } from '../../theme';
import { SmartTag, Baggage } from '@polyaero/shared';

interface SmartTagCardProps {
  tag: SmartTag;
  baggage?: Baggage;
}

export const SmartTagCard: React.FC<SmartTagCardProps> = ({ tag, baggage }) => {
  return (
    <View style={styles.cardContainer}>
      {/* Header with PolyAero Brand and Status */}
      <View style={styles.headerRow}>
        <View style={styles.brandBadge}>
          <Text style={styles.brandText}>POLYAERO SMARTTAG</Text>
        </View>
        <View style={styles.batteryContainer}>
          <Text style={styles.batteryText}>{tag.batteryLevel}% PWR</Text>
        </View>
      </View>

      {/* Physical E-ink Mock Representation */}
      <View style={styles.einkFrame}>
        <View style={styles.einkTopBar}>
          <Text style={styles.flightTag}>CX888</Text>
          <Text style={styles.destTag}>YVR</Text>
        </View>

        <View style={styles.einkDivider} />

        <View style={styles.einkDetails}>
          <View>
            <Text style={styles.einkLabel}>TAG NUMBER</Text>
            <Text style={styles.einkValue}>{baggage?.tagNumber ?? '0160892012'}</Text>
          </View>
          <View>
            <Text style={styles.einkLabel}>WEIGHT</Text>
            <Text style={styles.einkValue}>{baggage?.weightKg ?? 22.4} KG</Text>
          </View>
          <View>
            <Text style={styles.einkLabel}>CLASS</Text>
            <Text style={styles.einkValue}>PRIORITY J</Text>
          </View>
        </View>

        <View style={styles.einkStatusBar}>
          <Text style={styles.einkStatusText}>
            E-INK: {tag.einkDisplayStatus} • UID: {tag.tagUid.substring(0, 8)}...
          </Text>
        </View>
      </View>

      {/* Tracking Status */}
      <View style={styles.statusFooter}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>
          Live Status: <Text style={styles.statusBold}>{baggage?.currentStatus ?? 'LOADED'}</Text>
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    ...shadows.md,
    marginVertical: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  brandBadge: {
    backgroundColor: colors.brand.jadeLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  brandText: {
    color: colors.brand.jadePrimary,
    fontSize: typography.fontSize.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  batteryContainer: {
    backgroundColor: colors.surface.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  batteryText: {
    fontSize: typography.fontSize.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  einkFrame: {
    backgroundColor: colors.eink.displayBackground,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: '#333333',
  },
  einkTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  flightTag: {
    fontSize: typography.fontSize.title,
    fontWeight: '700',
    color: colors.eink.displayText,
    letterSpacing: 1,
  },
  destTag: {
    fontSize: typography.fontSize.display,
    fontWeight: '700',
    color: colors.brand.jadePrimary,
  },
  einkDivider: {
    height: 1.5,
    backgroundColor: '#333333',
    marginVertical: spacing.sm,
  },
  einkDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.xs,
  },
  einkLabel: {
    fontSize: 9,
    color: '#666666',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  einkValue: {
    fontSize: typography.fontSize.bodySm,
    fontWeight: '700',
    color: colors.eink.displayText,
    marginTop: 2,
  },
  einkStatusBar: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 0.5,
    borderTopColor: '#BBBBBB',
  },
  einkStatusText: {
    fontSize: 10,
    color: '#555555',
    fontWeight: '600',
  },
  statusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.success,
    marginRight: spacing.sm,
  },
  statusText: {
    fontSize: typography.fontSize.bodySm,
    color: colors.text.secondary,
  },
  statusBold: {
    color: colors.text.primary,
    fontWeight: '700',
  },
});
