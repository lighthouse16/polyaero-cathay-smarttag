import React, { useEffect } from 'react';
import { StyleSheet, View, Image, TouchableWithoutFeedback } from 'react-native';
import { StatusBar } from 'expo-status-bar';

interface CathaySplashScreenProps {
  onContinue?: () => void;
  autoAdvance?: boolean;
}

export const CathaySplashScreen: React.FC<CathaySplashScreenProps> = ({
  onContinue,
  autoAdvance = true,
}) => {
  useEffect(() => {
    if (!autoAdvance || !onContinue) return;
    const timer = setTimeout(() => {
      onContinue();
    }, 2200);
    return () => clearTimeout(timer);
  }, [autoAdvance, onContinue]);

  return (
    <TouchableWithoutFeedback onPress={onContinue}>
      <View style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.brandRow}>
          <Image
            source={require('../../../assets/cathay/cathay-splash-brand.png')}
            style={styles.brandImage}
            resizeMode="contain"
          />
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    width: '74%',
    maxWidth: 290,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandImage: {
    width: '100%',
    aspectRatio: 6.13,
  },
});
