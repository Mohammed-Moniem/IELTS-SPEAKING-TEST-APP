import { amber, blue, grass, red, slate, violet } from "@radix-ui/colors";

export const colors = {
  background: slate.slate1,
  backgroundMuted: slate.slate2,
  surface: "#ffffff",
  surfaceSubtle: slate.slate3,
  overlay: "#ffffff",
  border: slate.slate6,
  borderMuted: slate.slate5,
  divider: slate.slate4,
  textPrimary: slate.slate12,
  textSecondary: slate.slate11,
  textMuted: slate.slate9,
  textMutedStrong: slate.slate10,
  textInverse: "#ffffff",
  primary: blue.blue9,
  primaryHover: blue.blue10,
  primarySoft: blue.blue4,
  primaryStrong: blue.blue11,
  primaryOn: "#ffffff",
  secondary: violet.violet9,
  secondarySoft: violet.violet4,
  secondaryOn: "#ffffff",
  info: blue.blue9,
  infoSoft: blue.blue4,
  infoOn: "#ffffff",
  success: grass.grass9,
  successSoft: grass.grass4,
  successOn: grass.grass12,
  warning: amber.amber9,
  warningSoft: amber.amber4,
  warningOn: amber.amber12,
  danger: red.red9,
  dangerSoft: red.red4,
  dangerOn: "#ffffff",
  tabInactive: slate.slate8,
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
