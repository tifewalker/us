import type { WithSpringConfig } from "react-native-reanimated";

// Mirrors DESIGN.md → Motion.
export const PRESS_SCALE = 0.96;
export const REDUCED_PRESS_OPACITY = 0.7; // used instead of scale when Reduce Motion is on

export const springs = {
  press: { damping: 15, stiffness: 320, mass: 0.6 },
  tab: { damping: 14, stiffness: 220, mass: 0.7 },
} satisfies Record<string, WithSpringConfig>;

export const ENTRANCE_DURATION = 420;
export const ENTRANCE_RISE = 10;

// Polaroid tilt range, degrees.
export const POLAROID_MAX_TILT = 3;
