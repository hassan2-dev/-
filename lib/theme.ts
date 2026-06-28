import { Platform } from 'react-native';

export const Colors = {
  primary: '#3D9B4F',
  primaryDark: '#2B7340',
  primaryLight: '#E8F5EA',
  accent: '#FF8C42',
  background: '#F6F8F5',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F4F1',
  textDark: '#1A2A1C',
  textGray: '#5C6B5E',
  textLight: '#94A396',
  white: '#FFFFFF',
  black: '#000000',
  danger: '#E53935',
  discount: '#2E9E5B',
  border: '#E2EAE3',
  borderLight: '#EEF3EE',
  overlay: 'rgba(26, 42, 28, 0.55)',
  tabInactive: '#8A9A8C',
  // legacy aliases
  glassBackground: '#FFFFFF',
  glassBorder: '#E2EAE3',
  glassPage: '#F4F7F2',
  cardShadow: 'rgba(26, 42, 28, 0.08)',
  gradientStart: '#3D9B4F',
  gradientEnd: '#2B7340',
  inputBg: '#F8FAF8',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
};

export const BorderRadius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  round: 999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  title: 30,
};

export const Shadow = {
  sm: Platform.select({
    ios: {
      shadowColor: '#1A2A1C',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#1A2A1C',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 14,
    },
    android: { elevation: 4 },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#1A2A1C',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
    },
    android: { elevation: 8 },
    default: {},
  }),
};

export const Layout = {
  screenPadding: Spacing.lg,
  tabBarHeight: 58,
  headerHeight: 56,
  headerContentGap: Spacing.md,
  homeHeaderContentGap: Spacing.xl,
};

export const DELIVERY_COST = 1000;
export const WHATSAPP_NUMBER = '7744181839';
export const BACKGROUND_IMAGE =
  'https://images.unsplash.com/photo-1604719312566-8fa246131c11?q=80&w=1000&auto=format&fit=crop';
