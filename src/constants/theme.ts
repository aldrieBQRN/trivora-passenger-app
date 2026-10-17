/**
 * Trivora Passenger Theme
 * Faithful to the 12-screen UI mockup specification
 */

export const COLORS = {
  // Shared Trivora brand navy (#182B62) — same in the Passenger and Driver apps
  primary: '#182B62',
  primaryDark: '#141A31',
  primaryOnboarding: '#141A31',
  primaryHover: '#25449B',
  primaryLight: '#4A5275',
  primaryTint: '#EDEEF3', // subtle cool-neutral active surface

  // Surfaces & Backgrounds
  background: '#FFFFFF',
  backgroundSubtle: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceCard: '#FFFFFF',
  surfaceInput: '#F1F5F9',

  // Hairline Borders
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderFocus: '#182B62',

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
  darkBackground: '#141A31',
  darkSurface: '#182B62',
  darkSurfaceRaised: '#2A3358',
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
 * Named type scale. Every screen should draw its text styles from here instead of hand-rolling
 * fontSize/fontWeight pairs.
 *
 * Hierarchy rules (shared by the Passenger and Driver apps):
 * - Three weights only: 400 (reading text), 600 (titles, labels, emphasis), 700 (page titles and
 *   the one key value on a screen). Nothing heavier — Android renders 800/900 as Roboto Black,
 *   which made every line on a screen shout at the same volume.
 * - Nothing below 11px; 12px+ for anything a rider/driver must read at a glance.
 * - Emphasise the value, not its label (e.g. "₱126.00" is bigger than "Total Fare").
 */
/** App font, bundled by the expo-font config plugin in app.json as one family (weights 400–800),
 * so `fontWeight` picks the matching file. React Native has no global default font, so every
 * text style needs it — the TYPOGRAPHY tokens below carry it; raw text styles set it themselves. */
export const FONT_FAMILY = 'Plus Jakarta Sans';

export const TYPOGRAPHY = {
  display: { fontFamily: FONT_FAMILY, fontSize: 28, fontWeight: '700' as const, lineHeight: 34, letterSpacing: -0.4 },
  h1: { fontFamily: FONT_FAMILY, fontSize: 22, fontWeight: '700' as const, lineHeight: 28, letterSpacing: -0.2 },
  h2: { fontFamily: FONT_FAMILY, fontSize: 18, fontWeight: '700' as const, lineHeight: 24 },
  h3: { fontFamily: FONT_FAMILY, fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  bodyLarge: { fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: '600' as const, lineHeight: 21 },
  body: { fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySmall: { fontFamily: FONT_FAMILY, fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  caption: { fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  micro: { fontFamily: FONT_FAMILY, fontSize: 11, fontWeight: '600' as const, lineHeight: 14 },
  label: {
    fontFamily: FONT_FAMILY,
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
};

/** Named accent colors for place/category iconography (destination picker, etc). */
export const CATEGORY_COLORS = {
  government: '#182B62',
  market: '#D97706',
  hospital: '#EF4444',
  harbor: '#0284C7',
  school: '#7C3AED',
  leisure: '#059669',
};
