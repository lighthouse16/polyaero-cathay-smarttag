const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const NFC_TECH_FILTER_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:xliff="urn:oasis:names:tc:xliff:document:1.2">
  <tech-list>
    <tech>android.nfc.tech.IsoDep</tech>
  </tech-list>
  <tech-list>
    <tech>android.nfc.tech.Ndef</tech>
  </tech-list>
  <tech-list>
    <tech>android.nfc.tech.NfcA</tech>
  </tech-list>
</resources>
`;

function ensureIntentFilter(activity, actionName, dataAttributes) {
  if (!Array.isArray(activity['intent-filter'])) {
    activity['intent-filter'] = [];
  }
  const alreadyPresent = activity['intent-filter'].some((filter) =>
    (filter.action || []).some((a) => a.$?.['android:name'] === actionName)
  );
  if (alreadyPresent) return;

  const filter = {
    action: [{ $: { 'android:name': actionName } }],
    category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
  };
  if (dataAttributes) {
    filter.data = [{ $: dataAttributes }];
  }
  activity['intent-filter'].push(filter);
}

/**
 * Ensures Expo prebuild / EAS APK builds declare optional NFC hardware support,
 * register Android NFC dispatch intent filters on MainActivity, and allow LAN HTTP API calls.
 */
module.exports = function withNfcFeature(config) {
  const withTechResource = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const xmlDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, 'nfc_tech_filter.xml'), NFC_TECH_FILTER_XML, 'utf8');
      return modConfig;
    },
  ]);

  return withAndroidManifest(withTechResource, (modConfig) => {
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

    const mainActivity = application?.activity?.find(
      (act) => act.$?.['android:name'] === '.MainActivity'
    ) ?? application?.activity?.[0];

    if (mainActivity) {
      ensureIntentFilter(mainActivity, 'android.nfc.action.NDEF_DISCOVERED', {
        'android:mimeType': 'text/plain',
      });
      ensureIntentFilter(mainActivity, 'android.nfc.action.TECH_DISCOVERED');

      if (!Array.isArray(mainActivity['meta-data'])) {
        mainActivity['meta-data'] = [];
      }
      const hasTechMeta = mainActivity['meta-data'].some(
        (meta) => meta.$?.['android:name'] === 'android.nfc.action.TECH_DISCOVERED'
      );
      if (!hasTechMeta) {
        mainActivity['meta-data'].push({
          $: {
            'android:name': 'android.nfc.action.TECH_DISCOVERED',
            'android:resource': '@xml/nfc_tech_filter',
          },
        });
      }
    }

    return modConfig;
  });
};
