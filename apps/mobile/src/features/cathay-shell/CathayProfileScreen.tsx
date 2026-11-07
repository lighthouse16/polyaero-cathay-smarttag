import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserAuthProfile } from './CathayTypes';

interface CathayProfileScreenProps {
  user: UserAuthProfile;
  onOpenDevMenu?: () => void;
  onSignOut?: () => void;
  onOpenSignIn?: () => void;
}

export const CathayProfileScreen: React.FC<CathayProfileScreenProps> = ({
  user,
  onOpenDevMenu,
  onSignOut,
  onOpenSignIn,
}) => {
  const [showMemberCardModal, setShowMemberCardModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.headerSpacer} />
        <Text style={styles.topBarTitle}>Profile</Text>
        <TouchableOpacity onPress={onOpenDevMenu} style={styles.navBtn}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#1C2024" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.mainScroll} contentContainerStyle={styles.scrollContent}>
        {/* If Guest, show sign in / sign up banner */}
        {!user.isLoggedIn ? (
          <View style={styles.guestCard}>
            <Text style={styles.guestTitle}>Sign in to view your profile</Text>
            <Text style={styles.guestSub}>
              Access your digital membership card, Asia Miles balance, and exclusive tier benefits.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={onOpenSignIn}>
              <Text style={styles.primaryBtnText}>Sign in / Sign up</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* 1. MEMBER HEADER CARD (Matching frames #86 - #88 in video) */}
            <View style={styles.memberCardBox}>
              <View style={styles.memberCardHeaderRow}>
                <View>
                  <Text style={styles.memberName}>{`${user.familyName} ${user.givenName}`}</Text>
                  <Text style={styles.memberId}>{user.membershipNumber}</Text>
                </View>

                {/* QR Code button to open full digital card */}
                <TouchableOpacity
                  style={styles.qrCodeIconBtn}
                  onPress={() => setShowMemberCardModal(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="qr-code-outline" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.tierPill}>
                <Text style={styles.tierPillText}>{user.tierStatus} member</Text>
              </View>

              {/* Status Points Bar */}
              <View style={styles.statusPointsCard}>
                <View style={styles.pointsTopRow}>
                  <Text style={styles.pointsLabel}>Status Points</Text>
                  <Text style={styles.pointsValue}>{user.statusPoints} &gt;</Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: '12%' }]} />
                </View>

                <Text style={styles.pointsToNextText}>
                  {user.pointsToNextTier} more Status Points to reach Silver
                </Text>
                <Text style={styles.daysLeftText}>
                  You have 54 day(s) left to earn Status Points
                </Text>
              </View>

              {/* Asia Miles Row */}
              <View style={styles.asiaMilesCard}>
                <Text style={styles.asiaMilesLabel}>Asia Miles</Text>
                <Text style={styles.asiaMilesValue}>A {user.asiaMiles} &gt;</Text>
              </View>

              {/* Quick Actions Row: Edit profile, Transactions, My rewards */}
              <View style={styles.quickActionsRow}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setShowSettingsModal(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="person-outline" size={22} color="#006564" />
                  <Text style={styles.actionBtnLabel}>Edit profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setShowTransactionsModal(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="receipt-outline" size={22} color="#006564" />
                  <Text style={styles.actionBtnLabel}>Transactions</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setShowMemberCardModal(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="gift-outline" size={22} color="#006564" />
                  <Text style={styles.actionBtnLabel}>My rewards</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 2. COMPLETE YOUR PROFILE NOW (Matching frames #94 - #98 in video) */}
            <TouchableOpacity
              style={styles.completeProfileCard}
              onPress={() => setShowSettingsModal(true)}
              activeOpacity={0.85}
            >
              <View style={styles.completeHeaderRow}>
                <View style={styles.briefcaseIconWrap}>
                  <Ionicons name="briefcase" size={16} color="#006564" />
                </View>
                <View style={styles.completeTextCol}>
                  <Text style={styles.completeTitle}>Complete your profile now</Text>
                  <Text style={styles.completeSub}>
                    Enjoy hassle-free bookings, faster check-in and enhanced account security.
                  </Text>
                </View>
                <Text style={styles.stepFraction}>1/4</Text>
              </View>

              {/* Checklist breakdown */}
              <View style={styles.checklistSummary}>
                <View style={styles.checkRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.checkLabel}>Mobile number sign-in ID</Text>
                </View>
                <View style={styles.checkRow}>
                  <Ionicons name="ellipse-outline" size={16} color="#94A3B8" />
                  <Text style={styles.checkLabel}>Set your email address as sign-in ID</Text>
                </View>
                <View style={styles.checkRow}>
                  <Ionicons name="ellipse-outline" size={16} color="#94A3B8" />
                  <Text style={styles.checkLabel}>Add your travel document</Text>
                </View>
                <View style={styles.checkRow}>
                  <Ionicons name="ellipse-outline" size={16} color="#94A3B8" />
                  <Text style={styles.checkLabel}>Create your passkey</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* 3. MY BENEFITS SECTION (Matching frame #88 in video) */}
            <View style={styles.benefitsSection}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>My benefits</Text>
                <TouchableOpacity>
                  <Text style={styles.viewAllText}>View all</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.benefitCard}>
                <View style={styles.tierStatusTag}>
                  <View style={styles.greenDot} />
                  <Text style={styles.tierStatusTagText}>Current status: Green</Text>
                </View>
                <Text style={styles.unlockedHeading}>You've unlocked</Text>

                <View style={styles.benefitItem}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#006564" />
                  <Text style={styles.benefitItemText}>Priority online check-in (up to 48 hours in advance)</Text>
                </View>

                <View style={styles.benefitItem}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#006564" />
                  <Text style={styles.benefitItemText}>Extra legroom seats redemption</Text>
                </View>

                <View style={styles.benefitItem}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#006564" />
                  <Text style={styles.benefitItemText}>Extra baggage redemption & PolyAero SmartTag sync</Text>
                </View>

                <View style={styles.silverUnlockNotice}>
                  <Ionicons name="lock-closed" size={14} color="#64748B" />
                  <Text style={styles.silverUnlockNoticeText}>Reach Silver to unlock Business lounge access</Text>
                </View>
              </View>
            </View>

            {/* Sign Out Button */}
            {onSignOut && (
              <TouchableOpacity style={styles.signOutButton} onPress={onSignOut}>
                <Text style={styles.signOutButtonText}>Sign out</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* FULL DIGITAL MEMBERSHIP CARD MODAL (Matching frame #99 in video) */}
      <Modal visible={showMemberCardModal} transparent animationType="slide" onRequestClose={() => setShowMemberCardModal(false)}>
        <View style={styles.cardModalOverlay}>
          <SafeAreaView style={styles.cardModalSafeArea}>
            <View style={styles.cardModalHeader}>
              <TouchableOpacity onPress={() => setShowMemberCardModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={26} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.cardModalHeaderTitle}>Membership Card</Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.cardModalBody}>
              {/* Cathay Jade Green Digital Membership Card */}
              <View style={styles.modalGreenCard}>
                <View style={styles.modalCardTop}>
                  <View style={styles.cardBrandLockup}>
                    <Image
                      source={require('../../../assets/cathay/cathay-brushwing-white.png')}
                      style={styles.cardBrushwing}
                      resizeMode="contain"
                    />
                    <Text style={styles.cardBrandText}>CATHAY</Text>
                  </View>
                </View>

                <View style={styles.modalCardMiddle}>
                  <Text style={styles.modalCardPaxName}>{`${user.familyName} ${user.givenName}`}</Text>
                  <View style={styles.cardMetaGrid}>
                    <View>
                      <Text style={styles.metaKey}>MEMBERSHIP NUMBER</Text>
                      <Text style={styles.metaVal}>{user.membershipNumber}</Text>
                    </View>
                    <View>
                      <Text style={styles.metaKey}>STATUS</Text>
                      <Text style={styles.metaVal}>{user.tierStatus}</Text>
                    </View>
                    <View>
                      <Text style={styles.metaKey}>MEMBER SINCE</Text>
                      <Text style={styles.metaVal}>{user.memberSince}</Text>
                    </View>
                  </View>
                </View>

                {/* Scannable Lounge QR Code */}
                <View style={styles.qrCodeCenterWrap}>
                  <View style={styles.qrCodeBox}>
                    <Ionicons name="qr-code" size={140} color="#000000" />
                  </View>
                  <Text style={styles.scanHintText}>Scan at airport check-in or lounge access</Text>
                </View>

                {/* Add to Apple Wallet Button */}
                <TouchableOpacity style={styles.appleWalletBtn} activeOpacity={0.85}>
                  <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.appleWalletBtnText}>Add to Apple Wallet</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* SETTINGS / PROFILE DETAILS MODAL (Matching frames #156 - #160 in video) */}
      <Modal visible={showSettingsModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSettingsModal(false)}>
        <SafeAreaView style={styles.settingsSafeArea}>
          <View style={styles.settingsHeader}>
            <TouchableOpacity onPress={() => setShowSettingsModal(false)} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.settingsTitle}>Account details</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.settingsContent}>
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>Personal information</Text>
              <View style={styles.settingItemRow}>
                <Text style={styles.settingItemLabel}>Full name</Text>
                <Text style={styles.settingItemVal}>{`${user.familyName} ${user.givenName}`}</Text>
              </View>
              <View style={styles.settingItemRow}>
                <Text style={styles.settingItemLabel}>Date of birth</Text>
                <Text style={styles.settingItemVal}>16 June 2007</Text>
              </View>
              <View style={styles.settingItemRow}>
                <Text style={styles.settingItemLabel}>Country / region</Text>
                <Text style={styles.settingItemVal}>Hong Kong SAR (China)</Text>
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>Contact information</Text>
              <View style={styles.settingItemRow}>
                <Text style={styles.settingItemLabel}>Mobile number</Text>
                <Text style={styles.settingItemVal}>{user.mobile}</Text>
              </View>
              <View style={styles.settingItemRow}>
                <Text style={styles.settingItemLabel}>Email address</Text>
                <Text style={styles.settingItemVal}>{user.email}</Text>
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>Inflight preferences</Text>
              <View style={styles.settingItemRow}>
                <Text style={styles.settingItemLabel}>Seat preference</Text>
                <Text style={styles.settingItemVal}>Window</Text>
              </View>
              <View style={styles.settingItemRow}>
                <Text style={styles.settingItemLabel}>Special meal</Text>
                <Text style={styles.settingItemVal}>Standard Meal</Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* TRANSACTIONS MODAL (Matching frames #153 - #154 in video) */}
      <Modal visible={showTransactionsModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTransactionsModal(false)}>
        <SafeAreaView style={styles.settingsSafeArea}>
          <View style={styles.settingsHeader}>
            <TouchableOpacity onPress={() => setShowTransactionsModal(false)} style={styles.navBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.settingsTitle}>Transactions</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.transContent}>
            <Text style={styles.transHeaderHeading}>Miles & Points</Text>
            <Text style={styles.transSubtitle}>This page shows the transactions of your latest miles and points activities.</Text>

            <View style={styles.emptyTransBox}>
              <Ionicons name="receipt-outline" size={44} color="#94A3B8" />
              <Text style={styles.emptyTransTitle}>Upcoming in next statement</Text>
              <Text style={styles.emptyTransSub}>0 transactions</Text>
              <Text style={styles.emptyTransDetail}>You don't have any transactions at the moment.</Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C2024',
  },
  navBtn: {
    padding: 6,
  },
  headerSpacer: {
    width: 36,
  },
  mainScroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  guestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginVertical: 40,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 8,
  },
  guestSub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: '#006564',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  memberCardBox: {
    backgroundColor: '#004D4C',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  memberCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  memberName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  memberId: {
    fontSize: 13,
    color: '#D1EAE7',
    marginTop: 2,
  },
  qrCodeIconBtn: {
    padding: 4,
  },
  tierPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 10,
    marginBottom: 16,
  },
  tierPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statusPointsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  pointsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pointsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C2024',
  },
  pointsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#006564',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#006564',
  },
  pointsToNextText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1C2024',
  },
  daysLeftText: {
    fontSize: 11.5,
    color: '#718096',
    marginTop: 2,
  },
  asiaMilesCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  asiaMilesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C2024',
  },
  asiaMilesValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#006564',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 4,
  },
  actionBtnLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
  },
  completeProfileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  completeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  briefcaseIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E6F4F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeTextCol: {
    flex: 1,
  },
  completeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C2024',
  },
  completeSub: {
    fontSize: 12.5,
    lineHeight: 17,
    color: '#64748B',
    marginTop: 2,
  },
  stepFraction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#006564',
  },
  checklistSummary: {
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkLabel: {
    fontSize: 13,
    color: '#475569',
  },
  benefitsSection: {
    marginTop: 6,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C2024',
  },
  viewAllText: {
    fontSize: 13,
    color: '#006564',
    fontWeight: '600',
  },
  benefitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  tierStatusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  tierStatusTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  unlockedHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  benefitItemText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
    flex: 1,
  },
  silverUnlockNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  silverUnlockNoticeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  signOutButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  cardModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
  },
  cardModalSafeArea: {
    flex: 1,
  },
  cardModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
  },
  modalCloseBtn: {
    padding: 6,
  },
  cardModalHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardModalBody: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  modalGreenCard: {
    backgroundColor: '#006564',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  modalCardTop: {
    marginBottom: 20,
  },
  cardBrandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardBrushwing: {
    width: 28,
    height: 24,
  },
  cardBrandText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  modalCardMiddle: {
    marginBottom: 24,
  },
  modalCardPaxName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 14,
  },
  cardMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaKey: {
    color: '#D1EAE7',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  metaVal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  qrCodeCenterWrap: {
    alignItems: 'center',
    marginVertical: 14,
  },
  qrCodeBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
  },
  scanHintText: {
    color: '#D1EAE7',
    fontSize: 12,
    marginTop: 10,
  },
  appleWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 14,
    gap: 8,
  },
  appleWalletBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C2024',
  },
  settingsContent: {
    flex: 1,
    padding: 20,
  },
  settingsSection: {
    marginBottom: 24,
  },
  settingsSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 10,
  },
  settingItemRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  settingItemLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  settingItemVal: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1C2024',
    marginTop: 2,
  },
  transContent: {
    flex: 1,
    padding: 24,
  },
  transHeaderHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 6,
  },
  transSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 32,
  },
  emptyTransBox: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTransTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C2024',
    marginTop: 14,
  },
  emptyTransSub: {
    fontSize: 13,
    color: '#006564',
    fontWeight: '600',
    marginTop: 4,
  },
  emptyTransDetail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },
});
