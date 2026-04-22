export const colors = {
  bg: {
    base: '#F6F0E2',
    surface: '#FFFFFF',
    muted: '#EAE3D2',
    elevated: '#FFFFFF',
    creamTint: '#F0E9D7',
  },
  text: {
    primary: '#1F1722',
    secondary: '#5B576E',
    onBrand: '#FFFFFF',
    onAccent: '#1F1722',
  },
  brand: {
    pink: '#F2228E',
    purple: '#A833E6',
    lilac: '#8B5CF6',
    ink: '#1F1722',
    cream: '#F6F0E2',
  },
  accent: {
    lime: '#D2F73D',
    mint: '#1FD7B0',
    orange: '#FBA82A',
    glow: '#FB6CF1',
  },
  ui: {
    border: '#E2DDEA',
    divider: '#E2DDEA',
    input: '#E2DDEA',
    ring: '#F2228E',
    placeholder: '#5B576E',
    destructive: '#EF4444',
  },
  verdict: {
    low: '#1FD7B0',
    mid: '#FBA82A',
    high: '#F2228E',
    clown: '#A833E6',
  },
} as const;

export const gradients = {
  hero: [colors.brand.pink, colors.brand.purple, colors.brand.lilac] as const,
  acid: [colors.accent.lime, colors.accent.mint] as const,
  clown: [colors.brand.pink, colors.accent.orange] as const,
  result: ['#FFFFFF', '#FDE8F6', '#FFFFFF'] as const,
  chrome: ['#FFFFFF', colors.ui.border] as const,
  cream: [colors.bg.base, colors.bg.creamTint] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 7,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 26,
  xxxl: 40,
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  signature: 32,
  pill: 999,
} as const;

export const typography = {
  family: {
    body: 'FamiljenGrotesk_400Regular',
    bodyMedium: 'FamiljenGrotesk_500Medium',
    bodySemiBold: 'FamiljenGrotesk_600SemiBold',
    displayRegular: 'SpaceGrotesk_400Regular',
    displayMedium: 'SpaceGrotesk_500Medium',
    displaySemiBold: 'SpaceGrotesk_600SemiBold',
    displayBold: 'SpaceGrotesk_700Bold',
    editorial: 'InstrumentSerif_400Regular_Italic',
  },
  size: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 15,
    xl: 21,
    xxl: 32,
    display: 32,
  },
} as const;

export const shadows = {
  hard: {
    shadowColor: colors.brand.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  hardSmall: {
    shadowColor: colors.brand.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  soft: {
    shadowColor: colors.brand.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
} as const;

export const theme = {
  colors,
  gradients,
  spacing,
  radii,
  typography,
  shadows,
} as const;

export type Theme = typeof theme;
