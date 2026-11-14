const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Ensures Expo prebuild / EAS APK builds declare optional NFC hardware support
 * and allow LAN HTTP API calls in internal preview APKs.
 */
module.exports = function withNfcFeature(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;

    if (!Array.isArray(manifest['uses-feature'])) {
      manifest['uses-feature'] = [];
    }
    const hasNfcFeature = manifest['uses-feature'].some(
      (feature) => feature.$?.['android:name'] === 'android.hardware.nfc'
    );
    if (!hasNfcFeature) {
      manifest['uses-feature'].push({
        $: {
          'android:name': 'android.hardware.nfc',
          'android:required': 'false',
        },
      });
    }

    const application = manifest.application?.[0];
    if (application?.$) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }

    return modConfig;
  });
};
