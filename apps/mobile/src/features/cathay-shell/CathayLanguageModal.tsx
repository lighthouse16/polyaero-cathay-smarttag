import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CATHAY_FONT_FAMILY } from '../smarttag/components/CathaySmartTagPrimitives';

interface CathayLanguageModalProps {
  onConfirm: () => void;
  selectedLocation?: string;
  onSelectLocation?: () => void;
}

export const CathayLanguageModal: React.FC<CathayLanguageModalProps> = ({
  onConfirm,
  selectedLocation = 'Hong Kong SAR China - English',
  onSelectLocation,
}) => {
  return (
    <ImageBackground
      source={require('../../../assets/cathay/modal-backdrop.png')}
      style={styles.backdrop}
      resizeMode="cover"
    >
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.card}>
            {/* English Section */}
            <Text style={styles.englishTitle}>Language and country/territory</Text>
            <Text style={styles.bodyText}>
              To see the most relevant information, choose the country or territory where you live.
              Please note that the applicable terms and privacy policy may change depending on your
              choice.
            </Text>
            <Text style={[styles.bodyText, styles.paragraphSpacing]}>
              If your country is not listed, Cathay Pacific recommends choosing our flagship
              location, Hong Kong SAR China.
            </Text>

            {/* Traditional Chinese Section */}
            <Text style={styles.chineseTitle}>語言及國家/地區</Text>
            <Text style={styles.bodyText}>
              如要查閱最相關的資訊，請選擇你所居住的國家或地區。請注意，有關適用條款及私隱政策可能視乎你的選擇而有變。
            </Text>
            <Text style={[styles.bodyText, styles.paragraphSpacing]}>
              若未有列出你的國家／地區，國泰航空建議你選擇我們的旗艦地點—中國香港。
            </Text>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Country / Region Selector */}
            <TouchableOpacity
              style={styles.selectorContainer}
              onPress={onSelectLocation}
              activeOpacity={0.7}
            >
              <Text style={styles.selectorLabel}>COUNTRY/REGION - LANGUAGE</Text>
              <Text style={styles.selectorValue}>{selectedLocation}</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Confirm CTA */}
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={onConfirm}
              activeOpacity={0.7}
              testID="language-modal-confirm"
            >
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#EBECEE',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    width: '100%',
    maxWidth: 342,
    alignSelf: 'center',
  },
  englishTitle: {
    fontSize: 18.5,
    fontFamily: CATHAY_FONT_FAMILY,
    fontWeight: '300',
    color: '#1C2024',
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  chineseTitle: {
    fontSize: 15.5,
    fontFamily: CATHAY_FONT_FAMILY,
    fontWeight: '600',
    color: '#1C2024',
    marginTop: 16,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 13,
    fontFamily: CATHAY_FONT_FAMILY,
    lineHeight: 18.5,
    color: '#4A5568',
    fontWeight: '400',
  },
  paragraphSpacing: {
    marginTop: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#CBD5E1',
    marginHorizontal: -22,
    marginTop: 16,
  },
  selectorContainer: {
    paddingVertical: 12,
  },
  selectorLabel: {
    fontSize: 10.5,
    fontFamily: CATHAY_FONT_FAMILY,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#718096',
    textTransform: 'uppercase',
  },
  selectorValue: {
    fontSize: 15.5,
    fontFamily: CATHAY_FONT_FAMILY,
    fontWeight: '400',
    color: '#1A202C',
    marginTop: 4,
  },
  confirmButton: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: 16.5,
    fontFamily: CATHAY_FONT_FAMILY,
    fontWeight: '600',
    color: '#006564',
  },
});
