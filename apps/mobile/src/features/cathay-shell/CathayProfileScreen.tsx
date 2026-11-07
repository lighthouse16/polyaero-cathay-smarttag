import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
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
  const [showCompleteProfileModal, setShowCompleteProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoTitle, setInfoTitle] = useState('');
  const [infoBody, setInfoBody] = useState('');

  const openInfo = (title: string, body: string) => {
    setInfoTitle(title);
    setInfoBody(body);
    setShowInfoModal(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* If Guest, show authentic Cathay Member Sign in prompt */}
        {!user.isLoggedIn ? (
          <View style={styles.guestContainer}>
            <View style={styles.guestHeader}>
              <TouchableOpacity onPress={onOpenDevMenu} style={styles.topDevBtn}>
                <Ionicons name="ellipsis-horizontal" size={22} color="#1C2024" />
              </TouchableOpacity>
            </View>

            <View style={styles.guestCard}>
              <View style={styles.guestIconBadge}>
                <Ionicons name="person" size={28} color="#006564" />
              </View>
              <Text style={styles.guestTitle}>Become a Cathay member</Text>
              <Text style={styles.guestSub}>
                Unlock a world of exclusive member benefits and rewards: 48-hour priority online check-in, 24-hour free cancellation, and Asia Miles earning.
              </Text>
              <TouchableOpacity
                style={styles.guestPrimaryBtn}
                onPress={onOpenSignIn}
                activeOpacity={0.85}
              >
                <Text style={styles.guestPrimaryBtnText}>Sign in / Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Top discreet dev button in header area */}
            <View style={styles.topBar}>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={onOpenDevMenu} style={styles.topDevBtn}>
                <Ionicons name="ellipsis-horizontal" size={22} color="#718096" />
              </TouchableOpacity>
            </View>

            {/* 1. MEMBER CARD (Authentic Video Frames #94, #99, #100) */}
            <View style={styles.memberCardContainer}>
              {/* Green Card Header */}
              <View style={styles.memberCardHeader}>
                <View style={styles.memberInfoCol}>
                  <Text style={styles.memberName}>{`${user.familyName} ${user.givenName}`}</Text>
                  <View style={styles.memberIdRow}>
                    <Text style={styles.memberId}>{user.membershipNumber}</Text>
                    <Ionicons name="copy-outline" size={13} color="rgba(255, 255, 255, 0.75)" style={{ marginLeft: 6 }} />
                  </View>
                  <View style={styles.tierStatusBadge}>
                    <View style={styles.tierDot} />
                    <Text style={styles.tierStatusText}>{user.tierStatus} member</Text>
                  </View>
                </View>

                {/* Digital Card / QR Button */}
                <TouchableOpacity
                  style={styles.qrButton}
                  onPress={() => setShowMemberCardModal(true)}
                  activeOpacity={0.8}
                  testID="btn-open-member-card"
                >
                  <Ionicons name="qr-code-outline" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* White Card Inner Body: Status Points & Asia Miles */}
              <View style={styles.memberCardBody}>
                {/* Status Points Row */}
                <TouchableOpacity
                  style={styles.pointsBlock}
                  onPress={() =>
                    openInfo(
                      'Status Points',
                      'Earn Status Points on eligible flights with Cathay Pacific and oneworld alliance carriers to upgrade or renew your membership tier.'
                    )
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.metricHeaderRow}>
                    <Text style={styles.metricLabel}>Status Points</Text>
                    <View style={styles.metricValueRow}>
                      <Text style={styles.metricValue}>{user.statusPoints}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#718096" />
                    </View>
                  </View>

                  {/* Progress Track */}
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: '8%' }]} />
                  </View>

                  <Text style={styles.pointsProgressTarget}>
                    {user.pointsToNextTier} more Status Points to reach Silver
                  </Text>
                  <Text style={styles.pointsDaysLeft}>
                    You have 54 day(s) left to earn Status Points
                  </Text>
                </TouchableOpacity>

                <View style={styles.cardInternalDivider} />

                {/* Asia Miles Row */}
                <TouchableOpacity
                  style={styles.milesBlock}
                  onPress={() => setShowTransactionsModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.metricHeaderRow}>
                    <Text style={styles.metricLabel}>Asia Miles</Text>
                    <View style={styles.metricValueRow}>
                      <Text style={styles.asiaMilesCurrencySymbol}>A</Text>
                      <Text style={styles.metricValue}>{user.asiaMiles.toLocaleString()}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#718096" />
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* 2. YOUR 2027 STATUS PROGRESS SO FAR (Video Frame #94, #150) */}
            <View style={styles.progress2027Container}>
              <View style={styles.progress2027HeaderRow}>
                <Text style={styles.progress2027Title}>Your 2027 Status progress so far</Text>
                <View style={styles.greenPillBadge}>
                  <Text style={styles.greenPillText}>Green</Text>
                </View>
              </View>
            </View>

            {/* 3. COMPLETE YOUR PROFILE NOW (Video Frame #94, #97, #98) */}
            <TouchableOpacity
              style={styles.completeProfileCard}
              onPress={() => setShowCompleteProfileModal(true)}
              activeOpacity={0.85}
              testID="btn-complete-profile"
            >
              <View style={styles.completeProfileIconCol}>
                <Ionicons name="briefcase-outline" size={22} color="#006564" />
              </View>
              <View style={styles.completeProfileTextCol}>
                <Text style={styles.completeProfileTitle}>Complete your profile now</Text>
                <Text style={styles.completeProfileSub}>
                  Enjoy hassle-free bookings, faster check-in and enhanced account security.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#718096" />
            </TouchableOpacity>

            {/* 4. THREE ACTION BUTTONS: Edit profile, Transactions, My rewards (Video Frame #96, #97) */}
            <View style={styles.quickActionsRow}>
              {/* Button 1: Edit profile */}
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => setShowSettingsModal(true)}
                activeOpacity={0.7}
                testID="btn-edit-profile"
              >
                <Ionicons name="create-outline" size={26} color="#1C2024" style={styles.quickActionIcon} />
                <Text style={styles.quickActionLabel}>Edit profile</Text>
              </TouchableOpacity>

              {/* Button 2: Transactions */}
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => setShowTransactionsModal(true)}
                activeOpacity={0.7}
                testID="btn-transactions"
              >
                <Ionicons name="receipt-outline" size={26} color="#1C2024" style={styles.quickActionIcon} />
                <Text style={styles.quickActionLabel}>Transactions</Text>
              </TouchableOpacity>

              {/* Button 3: My rewards */}
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => setShowRewardsModal(true)}
                activeOpacity={0.7}
                testID="btn-my-rewards"
              >
                <Ionicons name="gift-outline" size={26} color="#1C2024" style={styles.quickActionIcon} />
                <Text style={styles.quickActionLabel}>My rewards</Text>
              </TouchableOpacity>
            </View>

            {/* 5. ENHANCED MEMBERSHIP PROMO CARD (Video Frame #96, #97, #155) */}
            <View style={styles.enhancedCard}>
              <Text style={styles.enhancedCardTag}>Starting January 2027</Text>
              <Text style={styles.enhancedCardTitle}>Enhanced membership</Text>
              <Text style={styles.enhancedCardSub}>
                A smoother, simpler and better membership
              </Text>
              <TouchableOpacity
                onPress={() =>
                  openInfo(
                    'Enhanced membership 2027',
                    'Starting January 2027, Cathay is introducing a refined tier system with streamlined Status Points thresholds and faster redemption on upgrades and partner benefits.'
                  )
                }
                style={styles.enhancedLearnMoreBtn}
              >
                <Text style={styles.enhancedLearnMoreText}>Learn more →</Text>
              </TouchableOpacity>
            </View>

            {/* 6. MY BENEFITS SECTION (Video Frame #96, #163) */}
            <View style={styles.benefitsSection}>
              <View style={styles.benefitsHeaderRow}>
                <Text style={styles.benefitsSectionTitle}>My benefits</Text>
                <TouchableOpacity onPress={() => setShowRewardsModal(true)}>
                  <Text style={styles.viewAllLink}>View all</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.currentStatusRow}>
                <Text style={styles.currentStatusLabel}>Current status:</Text>
                <View style={styles.currentStatusPill}>
                  <Text style={styles.currentStatusPillText}>Green</Text>
                </View>
              </View>

              {/* Unlocked Benefits List Card */}
              <View style={styles.benefitsCardBox}>
                <Text style={styles.unlockedHeaderTitle}>You've unlocked</Text>

                <View style={styles.benefitListItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#006564" style={styles.benefitCheckIcon} />
                  <Text style={styles.benefitItemText}>Priority online check-in (up to 48 hours in advance)</Text>
                </View>

                <View style={styles.benefitListItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#006564" style={styles.benefitCheckIcon} />
                  <Text style={styles.benefitItemText}>Extra legroom seats redemption</Text>
                </View>

                {/* Direct SmartTag baggage benefit linkage */}
                <View style={styles.benefitListItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#006564" style={styles.benefitCheckIcon} />
                  <Text style={styles.benefitItemText}>Extra baggage redemption & PolyAero SmartTag sync</Text>
                </View>

                <View style={styles.benefitDivider} />

                <View style={styles.lockedMilestoneRow}>
                  <Ionicons name="lock-closed-outline" size={16} color="#718096" style={{ marginRight: 8 }} />
                  <Text style={styles.lockedMilestoneText}>Reach Silver to unlock airport lounge access</Text>
                </View>
              </View>
            </View>

            {/* Sign Out Button */}
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={onSignOut}
              activeOpacity={0.7}
            >
              <Text style={styles.signOutBtnText}>Sign out</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* MODAL 1: DIGITAL MEMBERSHIP CARD (Authentic Video Frame #99) */}
      <Modal
        visible={showMemberCardModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMemberCardModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMemberCardModal(false)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Membership Card</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalBodyCentered}>
            {/* Authentic Cathay Digital Member Card View */}
            <View style={styles.digitalCardShell}>
              <View style={styles.digitalCardTop}>
                <Text style={styles.digitalCardLogo}>CATHAY</Text>
                <Text style={styles.digitalCardTier}>GREEN</Text>
              </View>

              <Text style={styles.digitalCardMemberName}>
                {`${user.familyName} ${user.givenName}`}
              </Text>

              <View style={styles.digitalCardDataRow}>
                <View>
                  <Text style={styles.digitalCardDataLabel}>MEMBERSHIP NUMBER</Text>
                  <Text style={styles.digitalCardDataValue}>{user.membershipNumber}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.digitalCardDataLabel}>MEMBER SINCE</Text>
                  <Text style={styles.digitalCardDataValue}>2025</Text>
                </View>
              </View>

              {/* QR Barcode placeholder matching video */}
              <View style={styles.qrCodeContainer}>
                <Ionicons name="qr-code" size={140} color="#1C2024" />
                <Text style={styles.qrCodeCaption}>Scan at boarding gate or lounge reception</Text>
              </View>
            </View>

            {/* Apple Wallet action button matching frame #99 */}
            <TouchableOpacity
              style={styles.appleWalletBtn}
              onPress={() => setShowMemberCardModal(false)}
              activeOpacity={0.85}
            >
              <Ionicons name="wallet-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.appleWalletBtnText}>Add to Apple Wallet</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* MODAL 2: COMPLETE YOUR PROFILE (Authentic Video Frame #98) */}
      <Modal
        visible={showCompleteProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCompleteProfileModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCompleteProfileModal(false)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Complete your profile</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.completeProfileStepCounter}>1 of 4 completed</Text>

            <View style={styles.checklistGroup}>
              {/* Item 1: Mobile number */}
              <View style={styles.checklistItem}>
                <Ionicons name="checkmark-circle" size={22} color="#006564" />
                <View style={styles.checklistItemTextCol}>
                  <Text style={styles.checklistItemTitle}>Mobile number sign-in ID</Text>
                  <Text style={styles.checklistItemValue}>{user.mobile}</Text>
                </View>
              </View>

              {/* Item 2: Email */}
              <TouchableOpacity
                style={styles.checklistItem}
                onPress={() => openInfo('Email address', 'Your primary email is set to: ' + user.email)}
              >
                <Ionicons name="ellipse-outline" size={22} color="#CBD5E1" />
                <View style={styles.checklistItemTextCol}>
                  <Text style={styles.checklistItemTitle}>Set your email address as sign-in ID</Text>
                  <Text style={styles.checklistItemValue}>{user.email}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#718096" />
              </TouchableOpacity>

              {/* Item 3: Travel document */}
              <TouchableOpacity
                style={styles.checklistItem}
                onPress={() => openInfo('Travel document', 'Upload passport details for automatic API check-in.')}
              >
                <Ionicons name="ellipse-outline" size={22} color="#CBD5E1" />
                <View style={styles.checklistItemTextCol}>
                  <Text style={styles.checklistItemTitle}>Add your travel document</Text>
                  <Text style={styles.checklistItemSub}>Passport or National ID</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#718096" />
              </TouchableOpacity>

              {/* Item 4: Passkey */}
              <TouchableOpacity
                style={styles.checklistItem}
                onPress={() => openInfo('Passkey', 'Passkey enabled: Face ID / Touch ID instant authentication.')}
              >
                <Ionicons name="ellipse-outline" size={22} color="#CBD5E1" />
                <View style={styles.checklistItemTextCol}>
                  <Text style={styles.checklistItemTitle}>Create your passkey</Text>
                  <Text style={styles.checklistItemSub}>Fast & secure biometric sign-in</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#718096" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* MODAL 3: YOUR PROFILE SETTINGS MENU (Authentic Video Frame #158) */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSettingsModal(false)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Your profile</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView style={styles.modalBody}>
            {[
              { title: 'Account details', sub: 'Full name, date of birth, contact info' },
              { title: 'Account security', sub: 'Password, passkey, two-factor authentication' },
              { title: 'Travel documents', sub: 'Passports, identity cards and visas' },
              { title: 'Inflight preferences', sub: 'Seating, special dietary meals, entertainment' },
              { title: 'Travel companions', sub: 'Family and frequent travel guests' },
              { title: 'Redemption group', sub: 'Nominate redemption group members' },
              { title: 'Communication preference', sub: 'Email notifications, SMS flight alerts' },
            ].map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.settingsRowItem}
                onPress={() => openInfo(item.title, item.sub)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsRowTitle}>{item.title}</Text>
                  <Text style={styles.settingsRowSub}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#718096" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 4: TRANSACTIONS STATEMENTS (Authentic Video Frame #154) */}
      <Modal
        visible={showTransactionsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTransactionsModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowTransactionsModal(false)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Transactions</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.transactionsHeaderSubtitle}>miles and points activities</Text>
            <Text style={styles.transactionsExplainer}>
              It may take several months for miles to be credited to your account. For more details, please visit our FAQs.
            </Text>

            {/* Credit Card promotion box */}
            <View style={styles.creditCardPromoBox}>
              <Ionicons name="card-outline" size={28} color="#006564" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.creditCardPromoTitle}>Link your credit card now to earn even more miles</Text>
                <TouchableOpacity onPress={() => openInfo('Standard Chartered Cathay Mastercard', 'Earn 1 Asia Mile for every HKD 4 spent.')}>
                  <Text style={styles.creditCardPromoLink}>Link your card →</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Upcoming statement */}
            <View style={styles.upcomingStatementBox}>
              <View style={styles.upcomingStatementTop}>
                <Text style={styles.upcomingStatementTitle}>Upcoming in next statement (Pending)</Text>
                <Text style={styles.upcomingStatementCount}>0 transactions</Text>
              </View>
              <Text style={styles.upcomingStatementEmpty}>
                You don't have any transactions at the moment.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 5: MY REWARDS (Authentic Video Frame #161, #163) */}
      <Modal
        visible={showRewardsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRewardsModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowRewardsModal(false)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>My rewards</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.rewardsIntroTitle}>Explore more membership rewards</Text>
            <Text style={styles.rewardsIntroSub}>
              Elevate your Status and enjoy even more rewards — both on the ground and in the air.
            </Text>

            <View style={styles.unlockedBox}>
              <Text style={styles.unlockedBoxTitle}>Green member benefits</Text>
              <View style={styles.rewardItemRow}>
                <Ionicons name="checkmark-circle" size={18} color="#006564" />
                <Text style={styles.rewardItemText}>Priority online check-in (up to 48 hours in advance)</Text>
              </View>
              <View style={styles.rewardItemRow}>
                <Ionicons name="checkmark-circle" size={18} color="#006564" />
                <Text style={styles.rewardItemText}>Extra legroom seats redemption</Text>
              </View>
              <View style={styles.rewardItemRow}>
                <Ionicons name="checkmark-circle" size={18} color="#006564" />
                <Text style={styles.rewardItemText}>Extra baggage redemption & PolyAero SmartTag linking</Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 6: GENERIC INFO MODAL */}
      <Modal
        visible={showInfoModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowInfoModal(false)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={24} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{infoTitle}</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.infoModalText}>{infoBody}</Text>
            <TouchableOpacity
              style={styles.guestPrimaryBtn}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={styles.guestPrimaryBtnText}>Close</Text>
            </TouchableOpacity>
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
  mainScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  topDevBtn: {
    padding: 6,
  },

  /* Guest View */
  guestContainer: {
    padding: 20,
  },
  guestHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  guestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E8E5DF',
    alignItems: 'center',
  },
  guestIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E6F4F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 8,
    textAlign: 'center',
  },
  guestSub: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  guestPrimaryBtn: {
    backgroundColor: '#006564',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  guestPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  /* 1. Member Card Container */
  memberCardContainer: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D8D4CC',
    marginBottom: 16,
  },
  memberCardHeader: {
    backgroundColor: '#2E6C64',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  memberInfoCol: {
    flex: 1,
  },
  memberName: {
    fontSize: 21,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  memberIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  memberId: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  tierStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  tierDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#86EFAC',
    marginRight: 6,
  },
  tierStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  qrButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCardBody: {
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  pointsBlock: {
    paddingVertical: 4,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C2024',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C2024',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#E8E5DF',
    borderRadius: 3,
    marginVertical: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#006564',
    borderRadius: 3,
  },
  pointsProgressTarget: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C2024',
  },
  pointsDaysLeft: {
    fontSize: 11.5,
    color: '#718096',
    marginTop: 3,
  },
  cardInternalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E8E5DF',
    marginVertical: 14,
  },
  milesBlock: {
    paddingVertical: 4,
  },
  asiaMilesCurrencySymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: '#006564',
    marginRight: 2,
  },

  /* 2. 2027 Status Progress */
  progress2027Container: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E5DF',
  },
  progress2027HeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progress2027Title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C2024',
  },
  greenPillBadge: {
    backgroundColor: '#E6F4F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  greenPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006564',
  },

  /* 3. Complete Profile Banner */
  completeProfileCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E5DF',
    flexDirection: 'row',
    alignItems: 'center',
  },
  completeProfileIconCol: {
    marginRight: 14,
  },
  completeProfileTextCol: {
    flex: 1,
  },
  completeProfileTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#1C2024',
  },
  completeProfileSub: {
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
    marginTop: 3,
  },

  /* 4. Three Quick Action Buttons */
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginBottom: 24,
    paddingVertical: 6,
  },
  quickActionItem: {
    alignItems: 'center',
    width: '30%',
  },
  quickActionIcon: {
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#1C2024',
    fontWeight: '500',
    textAlign: 'center',
  },

  /* 5. Enhanced Membership Promo Card */
  enhancedCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#F7F6F3',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8E5DF',
  },
  enhancedCardTag: {
    fontSize: 11,
    fontWeight: '600',
    color: '#718096',
    marginBottom: 4,
  },
  enhancedCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 4,
  },
  enhancedCardSub: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  enhancedLearnMoreBtn: {
    marginTop: 10,
  },
  enhancedLearnMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#006564',
  },

  /* 6. My Benefits Section */
  benefitsSection: {
    marginHorizontal: 16,
    marginBottom: 28,
  },
  benefitsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  benefitsSectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1C2024',
    letterSpacing: -0.3,
  },
  viewAllLink: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#006564',
  },
  currentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  currentStatusLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  currentStatusPill: {
    backgroundColor: '#E6F4F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentStatusPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#006564',
  },
  benefitsCardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E5DF',
  },
  unlockedHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 12,
  },
  benefitListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  benefitCheckIcon: {
    marginRight: 10,
    marginTop: 1,
  },
  benefitItemText: {
    flex: 1,
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
  },
  benefitDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E8E5DF',
    marginVertical: 12,
  },
  lockedMilestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockedMilestoneText: {
    fontSize: 12,
    color: '#718096',
  },

  /* Sign out */
  signOutBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 30,
  },
  signOutBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Modals General */
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E5DF',
  },
  modalHeaderBtn: {
    padding: 6,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C2024',
  },
  modalHeaderSpacer: {
    width: 36,
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  modalBodyCentered: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoModalText: {
    fontSize: 14.5,
    lineHeight: 22,
    color: '#334155',
    marginBottom: 24,
  },

  /* Digital Card Modal */
  digitalCardShell: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#2E6C64',
    borderRadius: 16,
    padding: 22,
    marginBottom: 24,
  },
  digitalCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  digitalCardLogo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  digitalCardTier: {
    fontSize: 13,
    fontWeight: '700',
    color: '#86EFAC',
    letterSpacing: 1,
  },
  digitalCardMemberName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  digitalCardDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  digitalCardDataLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  digitalCardDataValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  qrCodeContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  qrCodeCaption: {
    fontSize: 11,
    color: '#718096',
    marginTop: 10,
    textAlign: 'center',
  },
  appleWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  appleWalletBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  /* Complete Profile Modal */
  completeProfileStepCounter: {
    fontSize: 13,
    fontWeight: '700',
    color: '#006564',
    marginBottom: 16,
  },
  checklistGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E5DF',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E5DF',
  },
  checklistItemTextCol: {
    flex: 1,
    marginLeft: 14,
  },
  checklistItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C2024',
  },
  checklistItemValue: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  checklistItemSub: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },

  /* Settings Modal */
  settingsRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E5DF',
  },
  settingsRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C2024',
  },
  settingsRowSub: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },

  /* Transactions Modal */
  transactionsHeaderSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  transactionsExplainer: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#64748B',
    marginBottom: 20,
  },
  creditCardPromoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F4F2',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A7D9D3',
    marginBottom: 24,
  },
  creditCardPromoTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1C2024',
    lineHeight: 18,
    marginBottom: 4,
  },
  creditCardPromoLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#006564',
  },
  upcomingStatementBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  upcomingStatementTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  upcomingStatementTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#1C2024',
  },
  upcomingStatementCount: {
    fontSize: 12,
    color: '#718096',
  },
  upcomingStatementEmpty: {
    fontSize: 13,
    color: '#64748B',
  },

  /* Rewards Modal */
  rewardsIntroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 6,
  },
  rewardsIntroSub: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#64748B',
    marginBottom: 20,
  },
  unlockedBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unlockedBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C2024',
    marginBottom: 12,
  },
  rewardItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  rewardItemText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
});
