import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserAuthProfile } from './CathayTypes';

interface CathaySignInModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (profile: Partial<UserAuthProfile>) => void;
  onSwitchToSignUp?: () => void;
}

export const CathaySignInModal: React.FC<CathaySignInModalProps> = ({
  visible,
  onClose,
  onSuccess,
  onSwitchToSignUp,
}) => {
  const [viewState, setViewState] = useState<'id' | 'password' | 'reset_phone' | 'reset_dob' | 'reset_otp' | 'reset_newpass' | 'reset_done'>('id');
  const [authMethod, setAuthMethod] = useState<'mobile' | 'email' | 'memberNumber'>('mobile');

  // Input states
  const [identifier, setIdentifier] = useState('70516618');
  const [password, setPassword] = useState('MyNameCMD#1606');
  const [showPassword, setShowPassword] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  // Reset states
  const [resetDob, setResetDob] = useState('16/06/2007');
  const [resetOtp, setResetOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('MyNameCMD#1606');

  const handleIdContinue = () => {
    if (!identifier.trim()) return;
    setViewState('password');
  };

  const handleSignIn = () => {
    // If password matches demo password, log in
    if (password === 'MyNameCMD#1606' || password.length >= 6) {
      onSuccess({
        isLoggedIn: true,
        title: 'Mr',
        familyName: 'Trinh',
        givenName: 'Hai Dang',
        email: 'haidang.trinh@gmail.com',
        mobile: '+852 70516618',
        tierStatus: 'Green',
        membershipNumber: '190 662 0194',
        memberSince: '2025',
      });
      onClose();
    } else {
      // Simulate incorrect password attempt counter
      setAttemptsLeft((prev) => (prev === null ? 5 : Math.max(1, prev - 1)));
    }
  };

  const handleResetComplete = () => {
    setViewState('password');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (viewState === 'password') setViewState('id');
              else if (viewState.startsWith('reset_')) setViewState('id');
              else onClose();
            }}
            style={styles.navButton}
          >
            <Ionicons name="chevron-back" size={24} color="#1C2024" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            {viewState.startsWith('reset_') ? 'Reset your password' : 'Sign in'}
          </Text>

          <TouchableOpacity onPress={onClose} style={styles.navButton}>
            <Ionicons name="close" size={24} color="#718096" />
          </TouchableOpacity>
        </View>

        {/* 1. ENTER IDENTIFIER (Mobile / Email / Member ID) */}
        {viewState === 'id' && (
          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.formContainer}>
              <Text style={styles.pageTitle}>Sign in to Cathay</Text>
              <Text style={styles.pageSubtitle}>Enter your registered mobile number, email, or membership number.</Text>

              {authMethod === 'mobile' && (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Country / Region code</Text>
                    <View style={styles.pickerBox}>
                      <Text style={styles.pickerText}>Hong Kong SAR (China) (+852)</Text>
                      <Ionicons name="chevron-down" size={18} color="#718096" />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Mobile number</Text>
                    <TextInput
                      style={styles.textInput}
                      value={identifier}
                      onChangeText={setIdentifier}
                      keyboardType="phone-pad"
                      placeholder="e.g. 70516618"
                    />
                  </View>
                </>
              )}

              {authMethod === 'email' && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email address</Text>
                  <TextInput
                    style={styles.textInput}
                    value={identifier}
                    onChangeText={setIdentifier}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="e.g. name@example.com"
                  />
                </View>
              )}

              {authMethod === 'memberNumber' && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Membership number</Text>
                  <TextInput
                    style={styles.textInput}
                    value={identifier}
                    onChangeText={setIdentifier}
                    placeholder="e.g. 190 662 0194"
                  />
                </View>
              )}

              <TouchableOpacity style={styles.primaryButton} onPress={handleIdContinue} activeOpacity={0.85}>
                <Text style={styles.primaryButtonText}>Continue</Text>
              </TouchableOpacity>

              {/* Or switch method */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.altButtonsCol}>
                {authMethod !== 'email' && (
                  <TouchableOpacity
                    style={styles.outlineButton}
                    onPress={() => {
                      setAuthMethod('email');
                      setIdentifier('haidang.trinh@gmail.com');
                    }}
                  >
                    <Text style={styles.outlineButtonText}>Email address</Text>
                  </TouchableOpacity>
                )}

                {authMethod !== 'memberNumber' && (
                  <TouchableOpacity
                    style={styles.outlineButton}
                    onPress={() => {
                      setAuthMethod('memberNumber');
                      setIdentifier('1906620194');
                    }}
                  >
                    <Text style={styles.outlineButtonText}>Membership number</Text>
                  </TouchableOpacity>
                )}

                {authMethod !== 'mobile' && (
                  <TouchableOpacity
                    style={styles.outlineButton}
                    onPress={() => {
                      setAuthMethod('mobile');
                      setIdentifier('70516618');
                    }}
                  >
                    <Text style={styles.outlineButtonText}>Mobile phone number</Text>
                  </TouchableOpacity>
                )}
              </View>

              {onSwitchToSignUp && (
                <View style={styles.signUpPromptRow}>
                  <Text style={styles.signUpPromptText}>Not a member yet? </Text>
                  <TouchableOpacity onPress={onSwitchToSignUp}>
                    <Text style={styles.signUpLinkText}>Sign up now</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {/* 2. ENTER PASSWORD */}
        {viewState === 'password' && (
          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.formContainer}>
              <Text style={styles.identifierDisplay}>
                {authMethod === 'mobile' ? `+852 ${identifier}` : identifier}
              </Text>

              {attemptsLeft !== null && (
                <View style={styles.errorBanner}>
                  <View style={styles.errorExclamationBox}>
                    <Text style={styles.errorExclamationMark}>!</Text>
                  </View>
                  <Text style={styles.errorBannerText}>
                    The password you entered is incorrect. You have {attemptsLeft} attempts left before your account will be locked. Please try again or{' '}
                    <Text style={styles.errorLink} onPress={() => setViewState('reset_phone')}>
                      reset your password
                    </Text>
                    . (CIAM_AUT_012) (603A52)
                  </Text>
                </View>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder="Enter password"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#718096" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleSignIn} activeOpacity={0.85}>
                <Text style={styles.primaryButtonText}>Sign in with password</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.forgotPassLink}
                onPress={() => setViewState('reset_phone')}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotPassText}>Forgot password</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* 3. RESET PASSWORD: PHONE */}
        {viewState === 'reset_phone' && (
          <ScrollView style={styles.content}>
            <View style={styles.formContainer}>
              <Text style={styles.pageTitle}>Reset your password</Text>
              <Text style={styles.pageSubtitle}>Mobile number can only be used to reset your password if it's been verified.</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Country / Region code</Text>
                <View style={styles.pickerBox}>
                  <Text style={styles.pickerText}>Hong Kong SAR (China) (+852)</Text>
                  <Ionicons name="chevron-down" size={18} color="#718096" />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mobile number</Text>
                <TextInput style={styles.textInput} value="+852 70516618" editable={false} />
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={() => setViewState('reset_dob')}>
                <Text style={styles.primaryButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* 4. RESET PASSWORD: DOB */}
        {viewState === 'reset_dob' && (
          <ScrollView style={styles.content}>
            <View style={styles.formContainer}>
              <Text style={styles.pageTitle}>Enter your date of birth</Text>
              <Text style={styles.pageSubtitle}>We need this to verify your identity.</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Date of birth (DD/MM/YYYY)</Text>
                <TextInput style={styles.textInput} value={resetDob} onChangeText={setResetDob} />
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={() => setViewState('reset_otp')}>
                <Text style={styles.primaryButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* 5. RESET PASSWORD: OTP */}
        {viewState === 'reset_otp' && (
          <ScrollView style={styles.content}>
            <View style={styles.formContainer}>
              <Text style={styles.pageTitle}>Enter the verification code</Text>
              <Text style={styles.pageSubtitle}>We've sent a one-time verification code to +852 7******18.</Text>

              <View style={styles.otpRow}>
                {resetOtp.map((val, i) => (
                  <TextInput
                    key={i}
                    style={styles.otpBox}
                    value={val}
                    onChangeText={(v) => {
                      const next = [...resetOtp];
                      next[i] = v.slice(-1);
                      setResetOtp(next);
                    }}
                    maxLength={1}
                    keyboardType="number-pad"
                    textAlign="center"
                  />
                ))}
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={() => setViewState('reset_newpass')}>
                <Text style={styles.primaryButtonText}>Verify</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* 6. RESET PASSWORD: NEW PASSWORD */}
        {viewState === 'reset_newpass' && (
          <ScrollView style={styles.content}>
            <View style={styles.formContainer}>
              <Text style={styles.pageTitle}>Create your password</Text>
              <Text style={styles.pageSubtitle}>Please create a secure password that meets the security criteria.</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>New password</Text>
                <TextInput
                  style={styles.textInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={() => setViewState('reset_done')}>
                <Text style={styles.primaryButtonText}>Submit new password</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* 7. RESET PASSWORD: SUCCESS HERO SCREEN */}
        {viewState === 'reset_done' && (
          <View style={styles.resetDoneContainer}>
            <View style={styles.resetDoneContent}>
              <Ionicons name="checkmark-circle" size={64} color="#006564" style={styles.checkIconCenter} />
              <Text style={styles.resetDoneTitle}>Your password has been updated and you have been signed out of all devices</Text>
              <Text style={styles.resetDoneSub}>
                Make your future sign-ins more seamless and secure, without needing a password. Tap below to create a passkey now.
              </Text>

              <TouchableOpacity style={styles.primaryButton} onPress={handleResetComplete}>
                <Text style={styles.primaryButtonText}>Sign in</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.outlineButton} onPress={handleResetComplete}>
                <Text style={styles.outlineButtonText}>Create a passkey</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  },
  navButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C2024',
  },
  content: {
    flex: 1,
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '400',
    color: '#1C2024',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  pageSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#52565A',
    marginBottom: 24,
  },
  identifierDisplay: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1C2024',
    marginBottom: 20,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '400',
    color: '#52565A',
    marginBottom: 6,
  },
  pickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#C4C6CA',
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  pickerText: {
    fontSize: 15,
    color: '#1C2024',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#C4C6CA',
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#1C2024',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C4C6CA',
    borderRadius: 4,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: '#1C2024',
  },
  eyeBtn: {
    padding: 6,
  },
  primaryButton: {
    backgroundColor: '#233D3B',
    borderRadius: 4,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '400',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#52565A',
  },
  altButtonsCol: {
    gap: 12,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#2E6E6D',
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  outlineButtonText: {
    fontSize: 15,
    color: '#2E6E6D',
    fontWeight: '400',
  },
  signUpPromptRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  signUpPromptText: {
    fontSize: 14,
    color: '#52565A',
  },
  signUpLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2E6E6D',
  },
  forgotPassLink: {
    alignSelf: 'flex-start',
    marginTop: 16,
  },
  forgotPassText: {
    fontSize: 14,
    color: '#2E6E6D',
    fontWeight: '400',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 3.5,
    borderLeftColor: '#87323A',
    borderRadius: 6,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  errorExclamationBox: {
    width: 18,
    height: 18,
    borderRadius: 3,
    backgroundColor: '#87323A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  errorExclamationMark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBannerText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#1C2024',
    flex: 1,
  },
  errorLink: {
    color: '#006564',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 52,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    fontSize: 22,
    fontWeight: '700',
    color: '#006564',
    backgroundColor: '#F8FAFC',
  },
  resetDoneContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  resetDoneContent: {
    alignItems: 'center',
  },
  checkIconCenter: {
    marginBottom: 16,
  },
  resetDoneTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C2024',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 28,
  },
  resetDoneSub: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
  },
});
