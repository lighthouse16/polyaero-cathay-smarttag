/**
 * PolyAero Cathay SmartTag Design Tokens Foundation
 * Base visual constants shared between Mobile (React Native) and Web (Staff Portal).
 */

export const colors = {
  // Brand Palettes
  brand: {
    jadePrimary: '#006564',      // Cathay signature jade green inspired
    jadeDark: '#004B4A',
    jadeLight: '#E6F0F0',
    goldAccent: '#C49A45',      // PolyAero gold accent
    goldLight: '#FBF5EA',
    navyDeep: '#0B2545',
  },

  // UI Surfaces & Neutrals
  surface: {
    background: '#F8FAFC',
    card: '#FFFFFF',
    elevated: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  text: {
    primary: '#0F172A',
    secondary: '#475569',
    muted: '#94A3B8',
    inverse: '#FFFFFF',
    accent: '#006564',
  },

  border: {
    subtle: '#E2E8F0',
    default: '#CBD5E1',
    active: '#006564',
  },

  // Semantic Status
  status: {
    success: '#00875A',
    successBackground: '#E3FCEF',
    warning: '#FFAB00',
    warningBackground: '#FFFAE6',
    danger: '#DE350B',
    dangerBackground: '#FFEBE6',
    info: '#0052CC',
    infoBackground: '#DEEBFF',
  },

  // E-Ink Physical Tag Contrast Colors
  eink: {
    displayBackground: '#F0EFEA',
    displayText: '#111111',
    displayAccent: '#8B0000', // 3-color e-ink red highlight
  },
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export const radii = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

export const typography = {
  fontSize: {
    caption: 11,
    bodySm: 13,
    body: 15,
    subtitle: 17,
    titleSm: 20,
    title: 24,
    display: 32,
  },
  lineHeight: {
    caption: 14,
    bodySm: 18,
    body: 22,
    subtitle: 24,
    titleSm: 28,
    title: 32,
    display: 40,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;

export type ThemeColors = typeof colors;
export type ThemeSpacing = typeof spacing;
export type ThemeRadii = typeof radii;
export type ThemeTypography = typeof typography;
