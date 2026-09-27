// Mirrors DESIGN.md → Shape & surfaces.
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const GUTTER = 20;

// Radius varies by object type — there is no single app radius.
export const radius = {
  photo: 2,
  paper: 6,
  badge: 6,
  input: 12,
  ticket: 14,
  tabBar: 30,
  pill: 999,
} as const;

// Height of the floating tab bar. Tab screens clear it with
// useTabBarClearance() / <ScreenBackground aboveTabBar>.
export const TAB_BAR_HEIGHT = 72;
