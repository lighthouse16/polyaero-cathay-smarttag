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

const BRUSHWING_WHITE = require('../../../assets/cathay/cathay-brushwing-white.png');
const ICON_ASIA_MILES = require('../../../assets/cathay/icon-asia-miles.png');
const ICON_EDIT_PROFILE = require('../../../assets/cathay/icon-profile-edit.png');
const ICON_TRANSACTIONS = require('../../../assets/cathay/icon-profile-transactions.png');
const ICON_REWARDS = require('../../../assets/cathay/icon-profile-rewards.png');
const ICON_BENEFIT_CHECKIN = require('../../../assets/cathay/icon-benefit-checkin.png');
const ICON_BENEFIT_LEGROOM = require('../../../assets/cathay/icon-benefit-legroom.png');
const ICON_BENEFIT_BAGGAGE = require('../../../assets/cathay/icon-benefit-baggage.png');
const ENHANCED_TOP = require('../../../assets/cathay/enhanced-top.jpg');
const ENHANCED_MID = require('../../../assets/cathay/enhanced-mid.jpg');
const ENHANCED_BOT = require('../../../assets/cathay/enhanced-bot.jpg');

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
  const [showStatusPointsModal, setShowStatusPointsModal] = useState(false);
  const [show2027Modal, setShow2027Modal] = useState(false);

  const rawMemberId = user.membershipNumber.replace(/\s+/g, '');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!user.isLoggedIn ? (
          <View style={styles.guestContainer}>
            <View style={styles.guestHeader}>
              <TouchableOpacity onPress={onOpenDevMenu} style={styles.topDevBtn}>
                <Ionicons name="ellipsis-horizontal" size={22} color="#1C2024" />
              </TouchableOpacity>
            </View>

            <View style={styles.guestCard}>
              <View style={styles.guestIconBadge}>
                <Ionicons name="person-outline" size={28} color="#006564" />
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
          <View style={styles.contentWrapper}>
            {/* Authentic Soft Sage Asymmetric Top Backdrop (Frame #94) */}
            <View style={styles.topSageBackdrop} />

            {/* 1. MEMBER CARD (Green Header + Rounded Overlapping White Status Points Body) */}
            <View style={styles.memberCardOuter}>
              {/* Green Header with Diagonal Cathay Sheen */}
              <View style={styles.memberCardGreenHeader}>
                <View style={styles.memberCardDiagonalSheen} />

                <View style={styles.memberInfoCol}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onLongPress={onOpenDevMenu}
                  >
                    <Text style={styles.memberName}>{`${user.familyName} ${user.givenName}`}</Text>
                  </TouchableOpacity>

                  <View style={styles.memberIdRow}>
                    <Text style={styles.memberIdText}>{rawMemberId}</Text>
                    <Ionicons
                      name="document-text-outline"
                      size={15}
                      color="rgba(255, 255, 255, 0.9)"
                      style={styles.copyDocIcon}
                    />
                  </View>

                  <Text style={styles.tierLabelText}>{user.tierStatus} member</Text>
                </View>

                {/* Circular QR Code Button */}
                <TouchableOpacity
                  style={styles.qrCircleBtn}
                  onPress={() => setShowMemberCardModal(true)}
                  activeOpacity={0.8}
                  testID="btn-open-member-card"
                >
                  <Ionicons name="qr-code-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* White Overlapping Status Points Body */}
              <View style={styles.statusPointsBody}>
                <TouchableOpacity
                  style={styles.statusPointsTopTouch}
                  onPress={() => setShowStatusPointsModal(true)}
                  activeOpacity={0.75}
                >
                  <View>
                    <Text style={styles.goldLabelText}>Status Points</Text>
                    <Text style={styles.statusPointsBigNum}>{user.statusPoints}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#2C3034" style={styles.statusChevron} />
                </TouchableOpacity>

                {/* Subtle Hairline Divider */}
                <View style={styles.statusHairline} />

                {/* Progress Bar + Silver Card Milestone Circle */}
                <View style={styles.progressMilestoneRow}>
                  <View style={styles.progressTrack} />
                  <View style={styles.milestoneCircle}>
                    <View style={styles.miniSilverCard}>
                      <Image source={BRUSHWING_WHITE} style={styles.miniCardWing} resizeMode="contain" />
                    </View>
                  </View>
                </View>

                {/* 300 more Status Points to reach Silver */}
                <Text style={styles.reachSilverText}>
                  <Text style={styles.reachSilverBold}>{user.pointsToNextTier}</Text> more Status Points to reach Silver
                </Text>

                {/* Warm Cream Notification Strip */}
                <View style={styles.daysLeftStrip}>
                  <Ionicons name="notifications" size={14} color="#7D5D26" style={styles.daysLeftBell} />
                  <Text style={styles.daysLeftText}>
                    You have 54 day(s) left to earn Status Points
                  </Text>
                </View>
              </View>
            </View>

            {/* 2. ASIA MILES FLOATING CARD */}
            <TouchableOpacity
              style={styles.asiaMilesCard}
              onPress={() => setShowTransactionsModal(true)}
              activeOpacity={0.8}
              testID="card-asia-miles"
            >
              <Text style={styles.goldLabelText}>Asia Miles</Text>
              <View style={styles.asiaMilesRightRow}>
                <Image source={ICON_ASIA_MILES} style={styles.asiaMilesLogoImg} resizeMode="contain" />
                <Text style={styles.asiaMilesValueText}>{user.asiaMiles.toLocaleString()}</Text>
                <Ionicons name="chevron-forward" size={20} color="#2C3034" />
              </View>
            </TouchableOpacity>

            {/* 3. YOUR 2027 STATUS PROGRESS SO FAR CARD */}
            <TouchableOpacity
              style={styles.progress2027Card}
              onPress={() => setShow2027Modal(true)}
              activeOpacity={0.8}
            >
              <View style={styles.progress2027LeftCol}>
                <Text style={styles.amberLabelText}>Your 2027 Status progress so far</Text>
                <View style={styles.greenTierRow}>
                  <View style={styles.miniGreenCard}>
                    <Image source={BRUSHWING_WHITE} style={styles.miniCardWing} resizeMode="contain" />
                  </View>
                  <Text style={styles.greenTierValueText}>Green</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#2C3034" />
            </TouchableOpacity>

            {/* 4. COMPLETE YOUR PROFILE NOW CARD */}
            <TouchableOpacity
              style={styles.completeProfileCard}
              onPress={() => setShowCompleteProfileModal(true)}
              activeOpacity={0.85}
              testID="btn-complete-profile"
            >
              <View style={styles.completeTopRow}>
                <View style={styles.completeTitleGroup}>
                  <Ionicons name="notifications" size={18} color="#7D5923" style={styles.completeBellIcon} />
                  <Text style={styles.completeTitleText}>Complete your profile now</Text>
                </View>
                <Ionicons name="chevron-forward" size={19} color="#2C3034" />
              </View>

              <Text style={styles.completeDescText}>
                Enjoy hassle-free bookings, faster check-in{'\n'}and enhanced account security.
              </Text>

              {/* Full-width 1/4 Progress Bar */}
              <View style={styles.completeProgressRow}>
                <View style={styles.completeProgressTrack}>
                  <View style={styles.completeProgressFill} />
                </View>
                <Text style={styles.completeProgressFraction}>1/4</Text>
              </View>
            </TouchableOpacity>

            {/* 5. THREE CIRCULAR ACTION BUTTONS (Frame #97) */}
            <View style={styles.circularActionsRow}>
              <TouchableOpacity
                style={styles.circularActionCol}
                onPress={() => setShowSettingsModal(true)}
                activeOpacity={0.75}
                testID="btn-edit-profile"
              >
                <View style={styles.circleOutlineBtn}>
                  <Image source={ICON_EDIT_PROFILE} style={styles.circleCustomIcon} resizeMode="contain" />
                </View>
                <Text style={styles.circleActionLabel}>Edit profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.circularActionCol}
                onPress={() => setShowTransactionsModal(true)}
                activeOpacity={0.75}
                testID="btn-transactions"
              >
                <View style={styles.circleOutlineBtn}>
                  <Image source={ICON_TRANSACTIONS} style={styles.circleCustomIcon} resizeMode="contain" />
                </View>
                <Text style={styles.circleActionLabel}>Transactions</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.circularActionCol}
                onPress={() => setShowRewardsModal(true)}
                activeOpacity={0.75}
                testID="btn-my-rewards"
              >
                <View style={styles.circleOutlineBtn}>
                  <Image source={ICON_REWARDS} style={styles.circleCustomIcon} resizeMode="contain" />
                </View>
                <Text style={styles.circleActionLabel}>My rewards</Text>
              </TouchableOpacity>
            </View>

            {/* 6. ENHANCED MEMBERSHIP FULL-WIDTH EDITORIAL SPLIT BANNER (Frame #96 & #97) */}
            <View style={styles.enhancedBanner}>
              <View style={styles.enhancedLeftCol}>
                <View style={styles.startingDatePill}>
                  <Text style={styles.startingDatePillText}>Starting 1 January 2027</Text>
                </View>

                <View style={styles.enhancedTextGroup}>
                  <Text style={styles.enhancedHeading}>Enhanced membership</Text>
                  <Text style={styles.enhancedSubheading}>
                    A smoother, simpler and better membership
                  </Text>

                  <TouchableOpacity
                    style={styles.learnMoreOutlineBtn}
                    onPress={() => setShow2027Modal(true)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.learnMoreOutlineBtnText}>Learn more</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.enhancedRightPhotosCol}>
                <Image source={ENHANCED_TOP} style={styles.enhancedPhotoItem} resizeMode="cover" />
                <Image source={ENHANCED_MID} style={styles.enhancedPhotoItem} resizeMode="cover" />
                <Image
                  source={ENHANCED_BOT}
                  style={[styles.enhancedPhotoItem, styles.enhancedPhotoBottomCurve]}
                  resizeMode="cover"
                />
              </View>
            </View>

            {/* 7. MY BENEFITS SECTION (Frame #96 & #163) */}
            <View style={styles.benefitsSection}>
              <View style={styles.benefitsSectionHeader}>
                <Text style={styles.benefitsSectionTitle}>My benefits</Text>
                <TouchableOpacity onPress={() => setShowRewardsModal(true)} activeOpacity={0.7}>
                  <Text style={styles.benefitsViewAllText}>View all</Text>
                </TouchableOpacity>
              </View>

              {/* Main Benefits Card */}
              <View style={styles.benefitsCard}>
                <View style={styles.benefitsCardInner}>
                  {/* Current Status Header inside Card */}
                  <View style={styles.currentStatusHeader}>
                    <View style={styles.currentStatusMintCircle}>
                      <View style={styles.miniGreenCard}>
                        <Image source={BRUSHWING_WHITE} style={styles.miniCardWing} resizeMode="contain" />
                      </View>
                    </View>
                    <View>
                      <Text style={styles.currentStatusGoldLabel}>Current status</Text>
                      <Text style={styles.currentStatusTierName}>Green</Text>
                    </View>
                  </View>

                  <Text style={styles.youveUnlockedTitle}>You've unlocked</Text>

                  {/* 3 Unlocked Items with Authentic Icons */}
                  <View style={styles.unlockedRow}>
                    <Image source={ICON_BENEFIT_CHECKIN} style={styles.benefitCustomIcon} resizeMode="contain" />
                    <Text style={styles.unlockedItemText}>
                      Priority online check-in (up to 48 hours in advance)
                    </Text>
                  </View>

                  <View style={styles.unlockedRow}>
                    <Image source={ICON_BENEFIT_LEGROOM} style={styles.benefitCustomIcon} resizeMode="contain" />
                    <Text style={styles.unlockedItemText}>Extra legroom seats redemption</Text>
                  </View>

                  <View style={styles.unlockedRow}>
                    <Image source={ICON_BENEFIT_BAGGAGE} style={styles.benefitCustomIcon} resizeMode="contain" />
                    <Text style={styles.unlockedItemText}>Extra baggage redemption</Text>
                  </View>

                  <View style={styles.benefitsHairline} />

                  {/* Dark Grey Pill: Reach Silver to unlock benefits */}
                  <View style={styles.reachSilverBadgePill}>
                    <Image source={BRUSHWING_WHITE} style={styles.reachSilverWing} resizeMode="contain" />
                    <Text style={styles.reachSilverBadgeText}>Reach Silver to unlock benefits</Text>
                  </View>

                  {/* Locked Silver Benefits (Frame #163) */}
                  <View style={styles.lockedItemRow}>
                    <Ionicons name="lock-closed-outline" size={16} color="#6B7280" style={styles.lockIcon} />
                    <Text style={styles.lockedItemText}>Business class lounge access</Text>
                  </View>

                  <View style={styles.lockedItemRow}>
                    <Ionicons name="lock-closed-outline" size={16} color="#6B7280" style={styles.lockIcon} />
                    <Text style={styles.lockedItemText}>
                      Business class counter check-in and priority group boarding
                    </Text>
                  </View>

                  <View style={styles.lockedItemRow}>
                    <Ionicons name="lock-closed-outline" size={16} color="#6B7280" style={styles.lockIcon} />
                    <Text style={styles.lockedItemText}>Advance seat reservation</Text>
                  </View>
                </View>

                {/* Card Grey Footer Bar: How to reach next status */}
                <TouchableOpacity
                  style={styles.cardFooterBar}
                  onPress={() => setShowStatusPointsModal(true)}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardFooterLeft}>
                    <Ionicons name="help-circle" size={20} color="#1C2024" style={{ marginRight: 8 }} />
                    <Text style={styles.cardFooterBoldText}>How to reach next status</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#2C3034" />
                </TouchableOpacity>
              </View>

              {/* 8. UNLOCK CREDIT CARD BENEFITS CARD (Frame #163) */}
              <View style={[styles.benefitsCard, { marginTop: 16 }]}>
                <View style={styles.benefitsCardInner}>
                  <View style={styles.creditCardHeaderRow}>
                    {/* Vertical Standard Chartered Cathay Mastercard Icon */}
                    <View style={styles.scMastercardArt}>
                      <Image source={BRUSHWING_WHITE} style={styles.scCardWing} resizeMode="contain" />
                      <View style={styles.mcCirclesWrap}>
                        <View style={styles.mcCircleRed} />
                        <View style={styles.mcCircleOrange} />
                      </View>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.currentStatusGoldLabel}>Unlock credit card benefits</Text>
                      <Text style={styles.scCardTitle}>
                        Standard Chartered Cathay Mastercard®
                      </Text>
                    </View>
                  </View>

                  <View style={styles.lockedItemRow}>
                    <Ionicons name="lock-closed-outline" size={16} color="#6B7280" style={styles.lockIcon} />
                    <Text style={styles.lockedItemText}>
                      Earn 20 Status Points for every HKD100,000 spent, up to 100 Status Points
                    </Text>
                  </View>

                  <View style={styles.lockedItemRow}>
                    <Ionicons name="lock-closed-outline" size={16} color="#6B7280" style={styles.lockIcon} />
                    <Text style={styles.lockedItemText}>
                      Get a 10% discount when redeeming hotel stays, car rentals and travel experiences with Asia Miles
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.cardFooterBar}
                  onPress={() => setShowTransactionsModal(true)}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardFooterLeft}>
                    <Ionicons name="sparkles" size={17} color="#1C2024" style={{ marginRight: 8 }} />
                    <Text style={styles.cardFooterBoldText}>Apply now</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#2C3034" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* MODAL 1: DIGITAL MEMBERSHIP CARD (Authentic Frame #99) */}
      <Modal
        visible={showMemberCardModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMemberCardModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandlePill} />
          </View>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMemberCardModal(false)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={26} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Membership Card</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.digitalCardModalBody}>
            <View style={styles.digitalCardBox}>
              <Image source={BRUSHWING_WHITE} style={styles.digitalCardBrushwing} resizeMode="contain" />

              <Text style={styles.digitalCardNameText}>{`${user.familyName} ${user.givenName}`}</Text>

              <View style={styles.digitalCardMetaGrid}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.digitalCardMetaLabel}>MEMBERSHIP NUMBER</Text>
                  <Text style={styles.digitalCardMetaValue}>{user.membershipNumber}</Text>

                  <Text style={[styles.digitalCardMetaLabel, { marginTop: 18 }]}>MEMBER SINCE</Text>
                  <Text style={styles.digitalCardMetaValue}>{user.memberSince || '2025'}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.digitalCardMetaLabel}>STATUS</Text>
                  <Text style={styles.digitalCardMetaValue}>{user.tierStatus}</Text>
                </View>
              </View>

              <View style={styles.digitalQrWhiteBox}>
                <Ionicons name="qr-code" size={156} color="#1C2024" />
              </View>
            </View>

            <TouchableOpacity
              style={styles.appleWalletPillBtn}
              onPress={() => setShowMemberCardModal(false)}
              activeOpacity={0.85}
            >
              <Ionicons name="wallet" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
              <View>
                <Text style={styles.appleWalletSmallText}>Add to</Text>
                <Text style={styles.appleWalletBigText}>Apple Wallet</Text>
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* MODAL 2: COMPLETE YOUR PROFILE (Authentic Frame #98) */}
      <Modal
        visible={showCompleteProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCompleteProfileModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandlePill} />
          </View>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCompleteProfileModal(false)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={26} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Complete your profile</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.stepCompletedLine}>
              <Text style={styles.stepCompletedTeal}>1 of 4</Text> completed
            </Text>

            <View style={styles.completeListRow}>
              <Ionicons name="phone-portrait-outline" size={20} color="#2E6B69" style={styles.completeListIcon} />
              <Text style={[styles.completeListText, { color: '#2E6B69' }]}>Mobile number sign-in ID</Text>
              <Ionicons name="checkmark-circle" size={20} color="#2E6B69" />
            </View>

            <TouchableOpacity style={styles.completeListRow} activeOpacity={0.7}>
              <Ionicons name="mail-outline" size={20} color="#1C2024" style={styles.completeListIcon} />
              <Text style={styles.completeListText}>Set your email address as sign-in ID</Text>
              <Ionicons name="chevron-forward" size={18} color="#2C3034" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.completeListRow} activeOpacity={0.7}>
              <Ionicons name="book-outline" size={20} color="#1C2024" style={styles.completeListIcon} />
              <Text style={styles.completeListText}>Add your travel document</Text>
              <Ionicons name="chevron-forward" size={18} color="#2C3034" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.completeListRow} activeOpacity={0.7}>
              <Ionicons name="key-outline" size={20} color="#1C2024" style={styles.completeListIcon} />
              <Text style={styles.completeListText}>Create your passkey</Text>
              <Ionicons name="chevron-forward" size={18} color="#2C3034" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* MODAL 3: YOUR PROFILE SETTINGS MENU (Authentic Frame #158) */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.yourProfileTopNav}>
            <TouchableOpacity onPress={() => setShowSettingsModal(false)} style={styles.modalHeaderBtn}>
              <Ionicons name="chevron-back" size={26} color="#1C2024" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.yourProfileBigHeading}>Your profile</Text>

            {[
              'Account details',
              'Account security',
              'Travel documents',
              'Inflight preferences',
              'Travel companions',
              'Redemption group',
              'Communication preference',
            ].map((title, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.yourProfileRowItem}
                activeOpacity={0.7}
              >
                <Text style={styles.yourProfileRowText}>{title}</Text>
                <Ionicons name="chevron-forward" size={19} color="#2C3034" />
              </TouchableOpacity>
            ))}

            {onSignOut && (
              <TouchableOpacity
                style={styles.signOutRowBtn}
                onPress={() => {
                  setShowSettingsModal(false);
                  onSignOut();
                }}
              >
                <Text style={styles.signOutRowText}>Sign out</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 4: TRANSACTIONS (Authentic Frame #154) */}
      <Modal
        visible={showTransactionsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTransactionsModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowTransactionsModal(false)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={26} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Transactions</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.txParagraph}>
              It may take several months for miles to be credited to your account. For more details, please visit our{' '}
              <Text style={styles.txTealLink}>FAQs</Text> for more details.
            </Text>

            <Text style={styles.txParagraph}>
              To search your transactions recorded in the past 24 months, please visit{' '}
              <Text style={styles.txTealLink}>My monthly statement page</Text> for further details.
            </Text>

            <View style={styles.linkCardPromoBox}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.linkCardPromoTitle}>
                  Link your credit card now to earn even more miles
                </Text>
                <TouchableOpacity style={styles.linkCardDarkBtn} activeOpacity={0.85}>
                  <Text style={styles.linkCardDarkBtnText}>Link your card</Text>
                </TouchableOpacity>
              </View>
              <Ionicons name="card-outline" size={56} color="#9E7B4F" />
            </View>

            <Text style={styles.viewStatementLink}>View statement  →</Text>

            <View style={styles.txTabsRow}>
              <View style={styles.txTabActive}>
                <Text style={styles.txTabActiveText}>Upcoming in next statement</Text>
              </View>
              <View style={styles.txTabInactive}>
                <Text style={styles.txTabInactiveText}>Pending</Text>
              </View>
            </View>

            <View style={styles.txUpcomingSummaryRow}>
              <Text style={styles.txUpcomingHeading}>Upcoming in next{'\n'}statement</Text>
              <Text style={styles.txZeroCount}>0 transactions</Text>
            </View>

            <View style={styles.txEmptyNotice}>
              <Text style={styles.txEmptyNoticeText}>
                You don't have any transactions at the moment.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 5: STATUS POINTS (Authentic Frame #93) */}
      <Modal
        visible={showStatusPointsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStatusPointsModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.yourProfileTopNav}>
            <TouchableOpacity onPress={() => setShowStatusPointsModal(false)} style={styles.modalHeaderBtn}>
              <Ionicons name="chevron-back" size={26} color="#1C2024" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <View style={styles.benefitsCard}>
              <View style={styles.benefitsCardInner}>
                <Text style={styles.goldLabelText}>Status Points</Text>
                <Text style={[styles.statusPointsBigNum, { marginVertical: 6 }]}>0</Text>
                <Text style={styles.reachSilverText}>
                  Earn points for the next status till <Text style={styles.reachSilverBold}>31 Dec 2026</Text>
                </Text>
              </View>
              <View style={styles.cardFooterBar}>
                <View style={styles.cardFooterLeft}>
                  <Ionicons name="calculator-outline" size={18} color="#1C2024" style={{ marginRight: 8 }} />
                  <Text style={styles.cardFooterBoldText}>Status Points calculator</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#2C3034" />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 6: 2027 MEMBERSHIP (Authentic Frame #95) */}
      <Modal
        visible={show2027Modal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShow2027Modal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandlePill} />
          </View>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShow2027Modal(false)} style={styles.modalHeaderBtn}>
              <Ionicons name="close" size={26} color="#1C2024" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>2027 Membership</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.txParagraph}>
              We are excited to launch a smoother, simpler, better membership programme, check your new status in 2027:
            </Text>

            <View style={styles.infoGreyBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Ionicons name="information-circle" size={18} color="#1C2024" style={{ marginRight: 6 }} />
                <Text style={styles.cardFooterBoldText}>Why are there two Status Points balances?</Text>
              </View>
              <Text style={styles.lockedItemText}>
                To check your status qualification for 2026, please refer to the Status Points balance shown in My Profile. To check your status for 2027, please refer to the Status Points accumulated in 2026.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 7: MY REWARDS (Authentic Frame #161) */}
      <Modal
        visible={showRewardsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRewardsModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.yourProfileTopNav}>
            <TouchableOpacity onPress={() => setShowRewardsModal(false)} style={styles.modalHeaderBtn}>
              <Ionicons name="chevron-back" size={26} color="#1C2024" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.yourProfileBigHeading}>My rewards</Text>

            <View style={[styles.linkCardPromoBox, { backgroundColor: '#E8F3F2', borderColor: '#D0E6E4' }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.linkCardPromoTitle}>Explore more membership rewards</Text>
                <Text style={[styles.lockedItemText, { marginBottom: 14 }]}>
                  Elevate your status and enjoy even more rewards — both on the ground and in the air.
                </Text>
                <TouchableOpacity
                  style={styles.linkCardDarkBtn}
                  onPress={() => setShowRewardsModal(false)}
                >
                  <Text style={styles.linkCardDarkBtnText}>Learn more</Text>
                </TouchableOpacity>
              </View>
              <Ionicons name="gift-outline" size={64} color="#2E6B69" />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const cardShadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
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
    paddingBottom: 36,
  },
  contentWrapper: {
    position: 'relative',
    paddingTop: 18,
  },

  /* Top Sage Asymmetric Wave Backdrop (Frame #94) */
  topSageBackdrop: {
    position: 'absolute',
    top: -40,
    left: 0,
    right: 0,
    height: 235,
    backgroundColor: '#D7E6E5',
    borderBottomLeftRadius: 96,
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
    ...cardShadow,
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
    fontWeight: '600',
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

  /* 1. Member Card Outer */
  memberCardOuter: {
    marginHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
    ...cardShadow,
  },
  memberCardGreenHeader: {
    backgroundColor: '#2B6E6D',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    overflow: 'hidden',
    position: 'relative',
  },
  memberCardDiagonalSheen: {
    position: 'absolute',
    right: -40,
    bottom: -50,
    width: 260,
    height: 180,
    backgroundColor: '#135958',
    borderTopLeftRadius: 180,
    transform: [{ rotate: '-8deg' }],
  },
  memberInfoCol: {
    flex: 1,
    zIndex: 2,
  },
  memberName: {
    fontSize: 22,
    fontWeight: '400',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  memberIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  memberIdText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  copyDocIcon: {
    marginLeft: 8,
  },
  tierLabelText: {
    fontSize: 13.5,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.92)',
    marginTop: 22,
  },
  qrCircleBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  /* Overlapping White Status Points Body */
  statusPointsBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginTop: -12,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    zIndex: 3,
  },
  statusPointsTopTouch: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goldLabelText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#827127',
  },
  statusPointsBigNum: {
    fontSize: 28,
    fontWeight: '400',
    color: '#1C2024',
    marginTop: 4,
  },
  statusChevron: {
    marginTop: 6,
  },
  statusHairline: {
    height: 1,
    backgroundColor: '#F0F0EE',
    marginTop: 14,
    marginBottom: 14,
  },
  progressMilestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    marginBottom: 6,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#F2F3F5',
    borderRadius: 4,
  },
  milestoneCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#C4C6CA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  miniSilverCard: {
    width: 24,
    height: 15,
    borderRadius: 2.5,
    backgroundColor: '#76777A',
    position: 'relative',
  },
  miniGreenCard: {
    width: 26,
    height: 17,
    borderRadius: 2.5,
    backgroundColor: '#2E6E6D',
    position: 'relative',
  },
  miniCardWing: {
    width: 6,
    height: 6,
    position: 'absolute',
    right: 3,
    bottom: 2.5,
  },
  reachSilverText: {
    fontSize: 15,
    color: '#2C3034',
    fontWeight: '400',
  },
  reachSilverBold: {
    fontWeight: '700',
    color: '#1C2024',
  },
  daysLeftStrip: {
    backgroundColor: '#F4EFE4',
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  daysLeftBell: {
    marginRight: 8,
  },
  daysLeftText: {
    fontSize: 12.5,
    color: '#785D2A',
    fontWeight: '400',
  },

  /* 2. Asia Miles Card */
  asiaMilesCard: {
    marginHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...cardShadow,
  },
  asiaMilesRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  asiaMilesLogoImg: {
    width: 21,
    height: 21,
    marginRight: 4,
  },
  asiaMilesValueText: {
    fontSize: 25,
    fontWeight: '400',
    color: '#1C2024',
    marginRight: 10,
  },

  /* 3. Your 2027 Status Progress Card */
  progress2027Card: {
    marginHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#EEF5F5',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...cardShadow,
  },
  progress2027LeftCol: {
    flex: 1,
  },
  amberLabelText: {
    fontSize: 14.5,
    fontWeight: '400',
    color: '#8A5A1E',
    marginBottom: 8,
  },
  greenTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenTierValueText: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1E2328',
    marginLeft: 10,
  },

  /* 4. Complete Your Profile Card */
  completeProfileCard: {
    marginHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F3EFE6',
    borderWidth: 1,
    borderColor: '#E5DFD2',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 22,
  },
  completeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  completeTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completeBellIcon: {
    marginRight: 10,
  },
  completeTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E2328',
  },
  completeDescText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#2C3034',
    marginTop: 6,
    marginBottom: 16,
  },
  completeProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completeProgressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    overflow: 'hidden',
  },
  completeProgressFill: {
    width: '25%',
    height: '100%',
    backgroundColor: '#366E6D',
    borderRadius: 4,
  },
  completeProgressFraction: {
    fontSize: 12.5,
    color: '#5C6066',
    marginLeft: 12,
    fontWeight: '400',
  },

  /* 5. Three Circular Action Buttons */
  circularActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  circularActionCol: {
    flex: 1,
    alignItems: 'center',
  },
  circleOutlineBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#C4C6CA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  circleCustomIcon: {
    width: 28,
    height: 28,
  },
  circleActionLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#1C2024',
    textAlign: 'center',
  },

  /* 6. Enhanced Membership Full-Width Split Editorial Banner */
  enhancedBanner: {
    flexDirection: 'row',
    backgroundColor: '#EFECE6',
    minHeight: 304,
    marginBottom: 32,
  },
  enhancedLeftCol: {
    flex: 1.35,
    paddingLeft: 20,
    paddingRight: 12,
    paddingVertical: 20,
    justifyContent: 'space-between',
  },
  startingDatePill: {
    backgroundColor: '#2E6B69',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  startingDatePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  enhancedTextGroup: {
    marginTop: 48,
  },
  enhancedHeading: {
    fontSize: 21,
    fontWeight: '400',
    color: '#1C2024',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  enhancedSubheading: {
    fontSize: 13,
    lineHeight: 18,
    color: '#2C3034',
    marginBottom: 20,
  },
  learnMoreOutlineBtn: {
    borderWidth: 1,
    borderColor: '#2E6B69',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
  },
  learnMoreOutlineBtnText: {
    color: '#2E6B69',
    fontSize: 14.5,
    fontWeight: '400',
  },
  enhancedRightPhotosCol: {
    flex: 1,
    flexDirection: 'column',
  },
  enhancedPhotoItem: {
    width: '100%',
    height: 102,
  },
  enhancedPhotoBottomCurve: {
    borderBottomLeftRadius: 28,
  },

  /* 7. My Benefits Section */
  benefitsSection: {
    paddingHorizontal: 20,
  },
  benefitsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  benefitsSectionTitle: {
    fontSize: 22,
    fontWeight: '400',
    color: '#1C2024',
  },
  benefitsViewAllText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#2E6B69',
  },
  benefitsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  benefitsCardInner: {
    padding: 20,
  },
  currentStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  currentStatusMintCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E6F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  currentStatusGoldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#827127',
    marginBottom: 2,
  },
  currentStatusTierName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C2024',
  },
  youveUnlockedTitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#1C2024',
    marginBottom: 14,
  },
  unlockedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  benefitCustomIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
    marginTop: 1,
  },
  unlockedItemText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    color: '#4B5563',
  },
  benefitsHairline: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  reachSilverBadgePill: {
    backgroundColor: '#52565A',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  reachSilverWing: {
    width: 12,
    height: 12,
    marginRight: 8,
  },
  reachSilverBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  lockedItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  lockIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  lockedItemText: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 20,
    color: '#4B5563',
  },
  cardFooterBar: {
    backgroundColor: '#F5F6F7',
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardFooterBoldText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C2024',
  },

  /* 8. Credit Card Benefits Card */
  creditCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  scMastercardArt: {
    width: 30,
    height: 46,
    borderRadius: 3,
    backgroundColor: '#134E4E',
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  scCardWing: {
    width: 10,
    height: 10,
  },
  mcCirclesWrap: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    flexDirection: 'row',
  },
  mcCircleRed: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#EB001B',
  },
  mcCircleOrange: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F79E1B',
    marginLeft: -2,
  },
  scCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C2024',
    lineHeight: 23,
  },

  /* Modals */
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  sheetHandlePill: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderBtn: {
    padding: 6,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C2024',
  },
  modalHeaderSpacer: {
    width: 38,
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },

  /* Digital Membership Card Modal (Frame #99) */
  digitalCardModalBody: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 24,
    alignItems: 'center',
  },
  digitalCardBox: {
    width: '100%',
    backgroundColor: '#568B87',
    borderRadius: 14,
    padding: 24,
    marginBottom: 24,
  },
  digitalCardBrushwing: {
    width: 28,
    height: 28,
    marginBottom: 28,
  },
  digitalCardNameText: {
    fontSize: 23,
    fontWeight: '400',
    color: '#FFFFFF',
    marginBottom: 28,
  },
  digitalCardMetaGrid: {
    flexDirection: 'row',
    marginBottom: 28,
  },
  digitalCardMetaLabel: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.78)',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  digitalCardMetaValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '400',
  },
  digitalQrWhiteBox: {
    width: 176,
    height: 176,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  appleWalletPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A3A3C',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  appleWalletSmallText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  appleWalletBigText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Complete Your Profile Modal (Frame #98) */
  stepCompletedLine: {
    fontSize: 14.5,
    color: '#1C2024',
    marginBottom: 20,
  },
  stepCompletedTeal: {
    color: '#2E6B69',
    fontWeight: '700',
  },
  completeListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  completeListIcon: {
    marginRight: 14,
  },
  completeListText: {
    flex: 1,
    fontSize: 15,
    color: '#1C2024',
  },

  /* Your Profile Settings Modal (Frame #158) */
  yourProfileTopNav: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  yourProfileBigHeading: {
    fontSize: 22,
    fontWeight: '400',
    color: '#1C2024',
    marginBottom: 20,
  },
  yourProfileRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  yourProfileRowText: {
    fontSize: 16,
    color: '#1C2024',
    fontWeight: '400',
  },
  signOutRowBtn: {
    paddingVertical: 22,
    alignItems: 'center',
    marginTop: 12,
  },
  signOutRowText: {
    fontSize: 15,
    color: '#DC2626',
    fontWeight: '500',
  },

  /* Transactions Modal (Frame #154) */
  txParagraph: {
    fontSize: 14.5,
    lineHeight: 22,
    color: '#1C2024',
    marginBottom: 16,
  },
  txTealLink: {
    color: '#2E6B69',
    fontWeight: '600',
  },
  linkCardPromoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F6F7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    marginVertical: 16,
  },
  linkCardPromoTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#1C2024',
    lineHeight: 21,
    marginBottom: 14,
  },
  linkCardDarkBtn: {
    backgroundColor: '#233D3B',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  linkCardDarkBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '500',
  },
  viewStatementLink: {
    fontSize: 15,
    color: '#2E6B69',
    marginVertical: 14,
  },
  txTabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 24,
  },
  txTabActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#2E6B69',
    paddingBottom: 12,
    marginRight: 28,
  },
  txTabActiveText: {
    fontSize: 16,
    color: '#1C2024',
    fontWeight: '400',
  },
  txTabInactive: {
    paddingBottom: 12,
  },
  txTabInactiveText: {
    fontSize: 16,
    color: '#4B5563',
  },
  txUpcomingSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  txUpcomingHeading: {
    fontSize: 18,
    color: '#1C2024',
    lineHeight: 24,
  },
  txZeroCount: {
    fontSize: 14.5,
    color: '#1C2024',
  },
  txEmptyNotice: {
    borderLeftWidth: 2,
    borderLeftColor: '#4B5563',
    paddingLeft: 14,
    paddingVertical: 4,
  },
  txEmptyNoticeText: {
    fontSize: 13.5,
    color: '#2C3034',
  },
  infoGreyBox: {
    backgroundColor: '#F5F6F7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
  },
});
