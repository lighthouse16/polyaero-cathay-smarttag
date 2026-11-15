import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { useFonts } from 'expo-font';

const CATHAY_FONT_FACES = [
  {
    fontFamily: 'Cathay Sans EN',
    fontDefinitions: [
      {
        path: require('../assets/fonts/cathay/CathaySans_WCorp_Lt.ttf'),
        weight: 300,
      },
      {
        path: require('../assets/fonts/cathay/CathaySans_WCorp_Rg.ttf'),
        weight: Platform.OS === 'web' ? '400 500' : 400,
      },
      {
        path: require('../assets/fonts/cathay/CathaySans_WCorp_Bd.ttf'),
        weight: Platform.OS === 'web' ? '600 700 800' : 700,
      },
    ],
  },
  {
    fontFamily: 'GT Walsheim',
    fontDefinitions: [
      {
        path: require('../assets/fonts/cathay/GT-Walsheim-Light.ttf'),
        weight: 300,
      },
      {
        path: require('../assets/fonts/cathay/GT-Walsheim-Regular.ttf'),
        weight: Platform.OS === 'web' ? '400 500' : 400,
      },
      {
        path: require('../assets/fonts/cathay/GT-Walsheim-Bold.ttf'),
        weight: Platform.OS === 'web' ? '600 700 800' : 700,
      },
    ],
  },
];

export default function RootLayout() {
  useFonts(CATHAY_FONT_FACES);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'smarttag-subtle-scrollbar';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          html, body {
            font-family: "Cathay Sans EN", "GT Walsheim", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          * {
            scrollbar-width: thin;
            scrollbar-color: rgba(0, 0, 0, 0.16) transparent;
          }
          ::-webkit-scrollbar {
            width: 5px;
            height: 5px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.14);
            border-radius: 999px;
            border: 1px solid transparent;
            background-clip: padding-box;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(0, 0, 0, 0.28);
            background-clip: padding-box;
          }
          ::-webkit-scrollbar-thumb:active {
            background: rgba(0, 0, 0, 0.42);
            background-clip: padding-box;
          }
          ::-webkit-scrollbar-corner {
            background: transparent;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F8FAFC' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="smarttag/[step]" />
      </Stack>
    </SafeAreaProvider>
  );
}
