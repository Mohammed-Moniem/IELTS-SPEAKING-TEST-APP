import { amber, grass, red } from "@radix-ui/colors";

// Spokio Brand Colors - Purple Palette
export const colors = {
  // Backgrounds
  background: "#FFFFFF",
  backgroundMuted: "#F8F7FB", // gray-50
  surface: "#FFFFFF",
  surfaceSubtle: "#F1EFF8", // gray-100
  overlay: "#FFFFFF",
  overlayBackdrop: "rgba(0, 0, 0, 0.55)",

  // Borders
  border: "rgba(124, 58, 237, 0.15)",
  borderMuted: "#E4E1F0", // gray-200
  divider: "#E4E1F0", // gray-200

  // Text
  textPrimary: "#221E2B", // gray-900
  textSecondary: "#4A4358", // gray-700
  textMuted: "#7A7090", // gray-500
  textMutedStrong: "#5E5670", // gray-600
  textInverse: "#FFFFFF",

  // Primary (Purple - Spokio Brand)
  primary: "#7C3AED", // brand-primary
  primaryHover: "#9333EA", // brand-primary-light
  primarySoft: "#F3E8FF", // purple-100
  primaryStrong: "#6D28D9", // brand-primary-dark
  primaryOn: "#FFFFFF",

  // Secondary (Pink accent)
  secondary: "#EC4899", // brand-secondary
  secondarySoft: "#FCE7F3",
  secondaryOn: "#FFFFFF",

  // Info
  info: "#8B5CF6", // brand-accent
  infoSoft: "#E9D5FF", // purple-200
  infoOn: "#FFFFFF",

  // Status colors (keep standard)
  success: grass.grass9,
  successSoft: grass.grass4,
  successOn: grass.grass12,
  warning: amber.amber9,
  warningSoft: amber.amber4,
  warningOn: amber.amber12,
  danger: red.red9,
  dangerSoft: red.red4,
  dangerOn: "#FFFFFF",

  // Semantic badges
  badgePremiumBackground: "#FEF3C7",
  badgePremiumText: "#78350F",
  badgePremiumBorder: "#FBBF24",

  // Semantic status banners
  statusInfoBackground: "#EEF2FF",
  statusInfoBorder: "#C7D2FE",
  statusInfoText: "#3730A3",

  // Semantic reward tier colors
  tierBronze: "#CD7F32",
  tierSilver: "#A8A8A8",
  tierGold: "#D4A017",
  tierPlatinum: "#B8BDC7",

  // Tab
  tabInactive: "#7A7090", // gray-500
};

export const radii = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  xxl: 16,
  pill: 999,
  full: 9999,
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const typography = {
  fontFamily: "System",
  fontFamilyMonospace: "Menlo",
};

export const shadows = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
};

export type ColorTokens = typeof colors;
