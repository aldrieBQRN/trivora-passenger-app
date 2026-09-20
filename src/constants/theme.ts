/**
 * Trivora Passenger Theme
 * Faithful to the 12-screen UI mockup specification
 */

export const COLORS = {
  // Brand Indigo-Navy (#1C2B5A)
  primary: '#1C2B5A',
  primaryDark: '#121C3A',
  primaryOnboarding: '#0E2140',
  primaryHover: '#22346B',
  primaryLight: '#4C5A85',
  primaryTint: '#EDEEF5', // subtle cool-neutral active surface

  // Surfaces & Backgrounds
  background: '#FFFFFF',
  backgroundSubtle: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceCard: '#FFFFFF',
  surfaceInput: '#F1F5F9',

  // Hairline Borders
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderFocus: '#1C2B5A',

  // Typography
  textPrimary: '#0F172A',     // Slate 900
  textSecondary: '#64748B',   // Slate 500
  textMuted: '#94A3B8',       // Slate 400
  textInverse: '#FFFFFF',

  // Semantics
  success: '#10B981',
  successLight: '#ECFDF5',
  successBorder: '#A7F3D0',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  danger: '#EF4444',
  dangerDark: '#DC2626',
  dangerDarker: '#991B1B',
  dangerLight: '#FEF2F2',
  dangerBorder: '#FECACA',
  dangerSurface: 'rgba(239, 68, 68, 0.12)',
  amber: '#F59E0B',
  amberLight: '#FFFBEB',
  goldBadge: '#F59E0B',
  sky: '#0284C7',
  skyLight: '#F0F9FF',
  violet: '#7C3AED',
  violetLight: '#F5F3FF',
  emerald: '#059669',
  emeraldLight: '#ECFDF5',

  // Dark surfaces (Onboarding, in-call UI, profile banner, inverse states)
  darkBackground: '#0D2040',
  darkSurface: '#152B52',
  darkSurfaceRaised: '#1E3A8A',
  darkBorder: 'rgba(255, 255, 255, 0.16)',
  darkTextPrimary: '#FFFFFF',
  darkTextSecondary: 'rgba(255, 255, 255, 0.72)',
  darkTextMuted: 'rgba(255, 255, 255, 0.48)',
};

export const SHADOWS = {
  none: {
    elevation: 0,
    shadowOpacity: 0,
  },
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sheet: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
};

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
};

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const BUTTONS = {
  touchHeight: 52,
  touchHeightSm: 40,
  touchHeightLg: 56,
};

/**
 * Named type scale. Every screen should draw its text styles from here
 * instead of hand-rolling fontSize/fontWeight pairs, so headers, labels and
 * body copy stay the same size everywhere they mean the same thing.
 */
export const TYPOGRAPHY = {
  display: { fontSize: 28, fontWeight: '900' as const, lineHeight: 34, letterSpacing: -0.3 },
  h1: { fontSize: 22, fontWeight: '900' as const, lineHeight: 28, letterSpacing: -0.2 },
  h2: { fontSize: 18, fontWeight: '800' as const, lineHeight: 24 },
  h3: { fontSize: 16, fontWeight: '800' as const, lineHeight: 21 },
  bodyLarge: { fontSize: 15, fontWeight: '700' as const, lineHeight: 20 },
  body: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
  bodySmall: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  caption: { fontSize: 11, fontWeight: '600' as const, lineHeight: 14 },
  micro: { fontSize: 10, fontWeight: '700' as const, lineHeight: 13 },
  label: {
    fontSize: 9,
    fontWeight: '700' as const,
    lineHeight: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
};

/** Named accent colors for place/category iconography (destination picker, etc). */
export const CATEGORY_COLORS = {
  government: '#1B3A69',
  market: '#D97706',
  hospital: '#EF4444',
  harbor: '#0284C7',
  school: '#7C3AED',
  leisure: '#059669',
};
