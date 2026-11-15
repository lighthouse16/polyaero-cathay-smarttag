import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CATHAY_FONT_FAMILY } from '../smarttag/components/CathaySmartTagPrimitives';

interface CathayMessageCentreModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CathayMessageCentreModal: React.FC<CathayMessageCentreModalProps> = ({
  visible,
  onClose,
}) => {
  const [tab, setTab] = useState<'notifications' | 'alerts'>('alerts');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={24} color="#1C2024" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Message centre</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Top Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'notifications' && styles.tabBtnActive]}
            onPress={() => setTab('notifications')}
          >
            <Text style={[styles.tabLabel, tab === 'notifications' && styles.tabLabelActive]}>
              Notifications
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, tab === 'alerts' && styles.tabBtnActive]}
            onPress={() => setTab('alerts')}
          >
            <Text style={[styles.tabLabel, tab === 'alerts' && styles.tabLabelActive]}>
              Travel alerts (3)
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {tab === 'alerts' && (
            <View style={styles.alertCard}>
              <View style={styles.alertMetaRow}>
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeExclamation}>!</Text>
                  <Text style={styles.alertBadgeText}>Travel alert 3</Text>
                </View>
                <Text style={styles.alertDate}>30 Mar 12:00 HKT (GMT+8)</Text>
              </View>

              <Text style={styles.alertHeading}>Restrictions on the carriage of lithium battery power banks</Text>

              <Text style={styles.alertParagraph}>
                In accordance with the latest guidance from the International Civil Aviation Organization (ICAO), the Hong Kong Civil Aviation Department has introduced additional restrictions on the carriage of lithium battery power banks.
              </Text>

              <Text style={styles.alertParagraph}>
                With immediate effect, the following applies to all Cathay Pacific flights:
              </Text>

              <View style={styles.bulletList}>
                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>Each customer may carry a maximum of two power banks, which must be packed in carry-on baggage only.</Text>
                </View>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>Use and recharging of power banks onboard is not permitted at any time during the flight.</Text>
                </View>

                <View style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>Any additional power banks will be confiscated by security screening authorities at Hong Kong International Airport.</Text>
                </View>
              </View>

              <Text style={styles.alertFooterNotice}>
                Customers are advised to check their carry-on items carefully before travelling to avoid inconvenience at the airport.
              </Text>
            </View>
          )}

          {tab === 'notifications' && (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No new notifications</Text>
              <Text style={styles.emptySub}>We will notify you about important updates regarding your bookings and Asia Miles account.</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  navBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: CATHAY_FONT_FAMILY,
    fontWeight: '600',
    color: '#1C2024',
  },
  placeholder: {
    width: 36,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#006564',
  },
  tabLabel: {
    fontSize: 14,
    fontFamily: CATHAY_FONT_FAMILY,
    fontWeight: '500',
    color: '#64748B',
  },
  tabLabelActive: {
    color: '#006564',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 18,
  },
  alertCard: {
    paddingBottom: 32,
  },
  alertMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  alertBadgeExclamation: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    fontFamily: CATHAY_FONT_FAMILY,
  },
  alertBadgeText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
    fontFamily: CATHAY_FONT_FAMILY,
  },
  alertDate: {
    fontSize: 12,
    fontFamily: CATHAY_FONT_FAMILY,
    color: '#718096',
  },
  alertHeading: {
    fontSize: 17,
    fontFamily: CATHAY_FONT_FAMILY,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 12,
    lineHeight: 24,
  },
  alertParagraph: {
    fontSize: 14,
    fontFamily: CATHAY_FONT_FAMILY,
    lineHeight: 20,
    color: '#334155',
    marginBottom: 12,
  },
  bulletList: {
    gap: 10,
    marginVertical: 10,
    paddingLeft: 4,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    fontSize: 16,
    fontFamily: CATHAY_FONT_FAMILY,
    color: '#006564',
    lineHeight: 20,
  },
  bulletText: {
    fontSize: 13.5,
    fontFamily: CATHAY_FONT_FAMILY,
    lineHeight: 19,
    color: '#334155',
    flex: 1,
  },
  alertFooterNotice: {
    fontSize: 13,
    fontFamily: CATHAY_FONT_FAMILY,
    lineHeight: 18,
    color: '#64748B',
    marginTop: 16,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: CATHAY_FONT_FAMILY,
    fontWeight: '600',
    color: '#1C2024',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: CATHAY_FONT_FAMILY,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
