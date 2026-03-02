import { amber, grass, red } from "@radix-ui/colors";

// Spokio Dark Theme - Same Purple Palette with Dark Backgrounds
export const darkColors = {
  // Backgrounds - Dark
  background: "#121212", // Pure dark (OLED-friendly)
  backgroundMuted: "#1A1625", // Dark purple-tinted
  surface: "#1E1B2E", // Dark surface
  surfaceSubtle: "#252136", // Slightly lighter
  overlay: "#1E1B2E",
  overlayBackdrop: "rgba(0, 0, 0, 0.72)",

  // Borders - Darker variants
  border: "rgba(124, 58, 237, 0.25)", // More visible in dark
  borderMuted: "#332D47", // Dark border
  divider: "#332D47",

  // Text - Light for dark background
  textPrimary: "#F8F7FB", // Light text
  textSecondary: "#C4BFD8", // Medium light
  textMuted: "#8B85A3", // Muted light
  textMutedStrong: "#A49CB8", // Less muted
  textInverse: "#121212", // Dark on light

  // Primary (Purple - Same as light mode)
  primary: "#7C3AED",
  primaryHover: "#9333EA",
  primarySoft: "#3D2166", // Darker soft variant
  primaryStrong: "#9333EA", // Lighter strong for visibility
  primaryOn: "#FFFFFF",

  // Secondary (Pink - Same as light mode)
  secondary: "#EC4899",
  secondarySoft: "#4A1F38", // Darker soft variant
  secondaryOn: "#FFFFFF",

  // Info
  info: "#8B5CF6",
  infoSoft: "#3A2563", // Darker soft variant
  infoOn: "#FFFFFF",

  // Status colors (adjusted for dark mode)
  success: grass.grass10, // Slightly brighter
  successSoft: "#1A2E1F", // Dark green soft
  successOn: grass.grass12,
  warning: amber.amber10, // Slightly brighter
  warningSoft: "#2E2610", // Dark amber soft
  warningOn: amber.amber12,
  danger: red.red10, // Slightly brighter
  dangerSoft: "#2E141A", // Dark red soft
  dangerOn: "#FFFFFF",

  // Semantic badges
  badgePremiumBackground: "#FDE68A",
  badgePremiumText: "#3F2A00",
  badgePremiumBorder: "#F59E0B",

  // Semantic status banners
  statusInfoBackground: "#1E243D",
  statusInfoBorder: "#334155",
  statusInfoText: "#BFDBFE",

  // Semantic reward tier colors
  tierBronze: "#D29350",
  tierSilver: "#B5B8C0",
  tierGold: "#E2BB3F",
  tierPlatinum: "#D0D5DD",

  // Tab
  tabInactive: "#8B85A3",
};
