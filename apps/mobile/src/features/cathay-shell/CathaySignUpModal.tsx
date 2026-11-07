import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserAuthProfile } from './CathayTypes';

interface CathaySignUpModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (user: Partial<UserAuthProfile>) => void;
}

export const CathaySignUpModal: React.FC<CathaySignUpModalProps> = ({
  visible,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1
  const [countryCode] = useState('Hong Kong SAR (China) (+852)');
  const [mobileNumber, setMobileNumber] = useState('70516618');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Step 2
  const [title, setTitle] = useState<'Mr' | 'Ms' | 'Mrs' | 'Miss'>('Mr');
  const [familyName, setFamilyName] = useState('Trinh');
  const [givenName, setGivenName] = useState('Hai Dang');
  const [dob, setDob] = useState('16/06/2007');
  const [email, setEmail] = useState('haidang.trinh@gmail.com');

  // Step 3
  const [emailPref, setEmailPref] = useState(true);
  const [smsPref, setSmsPref] = useState(true);
  const [offersPref, setOffersPref] = useState(true);
  const [surveyPref, setSurveyPref] = useState(true);

  // Step 4
  const [password, setPassword] = useState('MyNameCMD#1606');
  const [showPassword, setShowPassword] = useState(false);
  const [consentTerms, setConsentTerms] = useState(true);

  // Step 5
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(298); // 4m 58s

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (visible && step === 5 && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    }
    return () => clearInterval(timer);
  }, [visible, step, countdown]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `(${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')})`;
  };

  // Password rules validation
  const hasNumber = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasLength = password.length >= 8 && password.length <= 20;
  const hasSymbol = /[!#$^*]/.test(password);
  const isPasswordValid = hasNumber && hasUpper && hasLength && hasSymbol;

  const getPasswordStrength = () => {
    const score = [hasNumber, hasUpper, hasLength, hasSymbol].filter(Boolean).length;
    if (score <= 2) return { label: 'Weak', color: '#EF4444' };
    if (score === 3) return { label: 'Medium', color: '#F59E0B' };
    return { label: 'Strong', color: '#10B981' };
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!mobileNumber.trim()) {
        setPhoneError('Please enter a valid mobile phone number.');
        return;
      }
      setPhoneError(null);
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      if (!isPasswordValid || !consentTerms) return;
      setStep(5);
    } else if (step === 5) {
      onComplete({
        isLoggedIn: true,
        title,
        familyName,
        givenName,
        email,
        mobile: `+852 ${mobileNumber}`,
        tierStatus: 'Green',
        membershipNumber: '190 662 0194',
        memberSince: '2025',
      });
      onClose();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => (s - 1) as 1 | 2 | 3 | 4 | 5);
    } else {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Modal Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.navButton} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color="#1C2024" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Sign up to Cathay</Text>

          <TouchableOpacity onPress={onClose} style={styles.navButton} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color="#718096" />
          </TouchableOpacity>
        </View>

        {/* 5-Step Indicator */}
        <View style={styles.stepIndicatorRow}>
          {[1, 2, 3, 4, 5].map((s) => (
            <View key={s} style={styles.stepItem}>
              <Text style={[styles.stepText, step >= s && styles.stepTextActive]}>
                {s.toString().padStart(2, '0')}
              </Text>
              <View style={[styles.stepLine, step === s && styles.stepLineActive, step > s && styles.stepLineDone]} />
            </View>
          ))}
        </View>

        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* STEP 1: MOBILE NUMBER */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Enter your mobile phone number</Text>
              <Text style={styles.stepSubtitle}>Your mobile phone number will be used as your sign-in ID.</Text>

              {phoneError && (
                <View style={styles.errorBox}>
                  <Ionicons name="warning" size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{phoneError}</Text>
                </View>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Country / Region code</Text>
                <View style={styles.pickerBox}>
                  <Text style={styles.pickerText}>{countryCode}</Text>
                  <Ionicons name="chevron-down" size={18} color="#718096" />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mobile phone number</Text>
                <TextInput
                  style={styles.textInput}
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  keyboardType="phone-pad"
                  placeholder="e.g. 70516618"
                  placeholderTextColor="#A0AEC0"
                />
              </View>

              <TouchableOpacity style={styles.linkRow} activeOpacity={0.7}>
                <Text style={styles.linkText}>I don't have a mobile phone number →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: USER DETAILS */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Enter your information</Text>
              <Text style={styles.stepSubtitle}>
                We'll save your details so you can speed through online bookings and purchases. Please enter your name in English as it appears on your passport.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Title</Text>
                <View style={styles.titleSelectorRow}>
                  {(['Mr', 'Ms', 'Mrs', 'Miss'] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.titlePill, title === t && styles.titlePillActive]}
                      onPress={() => setTitle(t)}
                    >
                      <Text style={[styles.titlePillText, title === t && styles.titlePillTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Family name</Text>
                <TextInput style={styles.textInput} value={familyName} onChangeText={setFamilyName} placeholder="Trinh" />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Given name(s)</Text>
                <TextInput style={styles.textInput} value={givenName} onChangeText={setGivenName} placeholder="Hai Dang" />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Date of birth (DD/MM/YYYY)</Text>
                <TextInput style={styles.textInput} value={dob} onChangeText={setDob} placeholder="16/06/2007" />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email address</Text>
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="haidang.trinh@gmail.com"
                />
              </View>
            </View>
          )}

          {/* STEP 3: PREFERENCES */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Select your communication preferences</Text>
              <Text style={styles.stepSubtitle}>
                By checking the box(es) below, you agree to subscribe to our communications from Cathay via email or SMS. Your personal data will be handled in accordance with the CPA Customer Privacy Policy.
              </Text>

              <View style={styles.prefCard}>
                <View style={styles.prefRow}>
                  <View style={styles.prefTextCol}>
                    <Text style={styles.prefHeading}>Email</Text>
                    <Text style={styles.prefSub}>{email}</Text>
                  </View>
                  <Switch
                    value={emailPref}
                    onValueChange={setEmailPref}
                    trackColor={{ false: '#CBD5E1', true: '#006564' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.prefDivider} />

                <View style={styles.prefRow}>
                  <View style={styles.prefTextCol}>
                    <Text style={styles.prefHeading}>SMS</Text>
                    <Text style={styles.prefSub}>+852 {mobileNumber}</Text>
                  </View>
                  <Switch
                    value={smsPref}
                    onValueChange={setSmsPref}
                    trackColor={{ false: '#CBD5E1', true: '#006564' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.prefDivider} />

                <TouchableOpacity
                  style={styles.checkboxRow}
                  activeOpacity={0.8}
                  onPress={() => setOffersPref(!offersPref)}
                >
                  <Ionicons
                    name={offersPref ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={offersPref ? '#006564' : '#94A3B8'}
                  />
                  <Text style={styles.checkboxLabel}>Offers and promotions</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  activeOpacity={0.8}
                  onPress={() => setSurveyPref(!surveyPref)}
                >
                  <Ionicons
                    name={surveyPref ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={surveyPref ? '#006564' : '#94A3B8'}
                  />
                  <Text style={styles.checkboxLabel}>Survey</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 4: PASSWORD */}
          {step === 4 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Create your password</Text>
              <Text style={styles.stepSubtitle}>
                Your account security is important to us. Please create a secure password that meets the below criteria.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder="Enter password"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#718096" />
                  </TouchableOpacity>
                </View>

                {/* Strength Meter */}
                <View style={styles.strengthRow}>
                  <Text style={[styles.strengthLabel, { color: getPasswordStrength().color }]}>
                    {getPasswordStrength().label}
                  </Text>
                </View>
              </View>

              {/* Requirement Checklist */}
              <View style={styles.checklistContainer}>
                {[
                  { text: 'At least 1 number', valid: hasNumber },
                  { text: 'At least 1 uppercase letter', valid: hasUpper },
                  { text: 'Between 8-20 characters', valid: hasLength },
                  { text: 'At least one symbol in list (! # $ ^ *) and any other is not allowed', valid: hasSymbol },
                ].map((item, idx) => (
                  <View key={idx} style={styles.checkItem}>
                    <Ionicons
                      name={item.valid ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={item.valid ? '#10B981' : '#94A3B8'}
                    />
                    <Text style={[styles.checkText, item.valid && styles.checkTextValid]}>{item.text}</Text>
                  </View>
                ))}
              </View>

              {/* Consent Checkbox */}
              <TouchableOpacity
                style={styles.consentRow}
                activeOpacity={0.8}
                onPress={() => setConsentTerms(!consentTerms)}
              >
                <Ionicons
                  name={consentTerms ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={consentTerms ? '#006564' : '#94A3B8'}
                />
                <Text style={styles.consentText}>
                  I consent to the <Text style={styles.consentLink}>Terms and Conditions</Text> and acknowledge that all membership and Status Points earning periods will end on 31 December 2026.
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 5: EMAIL OTP */}
          {step === 5 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Enter Email verification code</Text>
              <Text style={styles.stepSubtitle}>
                We've sent a one-time verification code to <Text style={styles.boldText}>{email}</Text>.
              </Text>

              {/* 6-box OTP entry */}
              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    style={styles.otpBox}
                    value={digit}
                    onChangeText={(val) => {
                      const next = [...otp];
                      next[i] = val.slice(-1);
                      setOtp(next);
                    }}
                    maxLength={1}
                    keyboardType="number-pad"
                    textAlign="center"
                  />
                ))}
              </View>

              <Text style={styles.countdownText}>
                Code can be resent in <Text style={styles.boldText}>{formatCountdown(countdown)}</Text>
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Action Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.continueButton, step === 4 && (!isPasswordValid || !consentTerms) && styles.continueButtonDisabled]}
            onPress={handleNextStep}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>{step === 5 ? 'Verify & Sign up' : 'Continue'}</Text>
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 16,
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  navButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C2024',
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    justifyContent: 'space-between',
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
  },
  stepTextActive: {
    color: '#006564',
  },
  stepLine: {
    height: 3,
    width: '100%',
    backgroundColor: '#E2E8F0',
    borderRadius: 1.5,
  },
  stepLineActive: {
    backgroundColor: '#006564',
  },
  stepLineDone: {
    backgroundColor: '#10B981',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  stepContent: {},
  stepTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1C2024',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    marginBottom: 24,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 6,
  },
  pickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  pickerText: {
    fontSize: 15,
    color: '#1E293B',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  titleSelectorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  titlePill: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  titlePillActive: {
    borderColor: '#006564',
    backgroundColor: '#E6F4F2',
  },
  titlePillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  titlePillTextActive: {
    color: '#006564',
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    flex: 1,
  },
  linkRow: {
    marginTop: 8,
  },
  linkText: {
    fontSize: 14,
    color: '#006564',
    fontWeight: '500',
  },
  prefCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  prefTextCol: {
    flex: 1,
  },
  prefHeading: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  prefSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  prefDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  eyeButton: {
    padding: 6,
  },
  strengthRow: {
    marginTop: 6,
    alignItems: 'flex-end',
  },
  strengthLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  checklistContainer: {
    gap: 10,
    marginTop: 8,
    marginBottom: 20,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
  },
  checkTextValid: {
    color: '#1E293B',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 10,
    gap: 10,
  },
  consentText: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#475569',
    flex: 1,
  },
  consentLink: {
    color: '#006564',
    textDecorationLine: 'underline',
  },
  boldText: {
    fontWeight: '700',
    color: '#1E293B',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 24,
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
  countdownText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  bottomBar: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  continueButton: {
    backgroundColor: '#006564',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
