// Mirrors DESIGN.md → Color. Change DESIGN.md first, then this file.
export const colors = {
  // Core palette
  deepOcean: "#071A2B",
  ocean: "#126E82",
  sky: "#7EC8E3",
  sand: "#F5D7A1",
  sunset: "#FF8C69",
  warmWhite: "#FFF8EF",
  coral: "#FF6B6B", // hearts / key moments only

  // Paper
  paper: "#FBF1E1",
  paperDeep: "#F3E2C4",
  paperEdge: "#E7CFA6",

  // Ink
  ink: "#2B2520",
  inkSoft: "#6E5F52",
  inkFaint: "#A8968A",
  inkOcean: "#0E3A4F",
  onDark: "#FFF8EF",
  onDarkSoft: "rgba(255,248,239,0.72)",

  shadow: "#7A4A1E",
  danger: "#C4553F", // destructive actions only (delete) — warm terracotta, not coral
} as const;

export const tape = {
  sand: "#F5D7A1",
  sky: "#BFE3F0",
  coral: "#FFB4A8",
  mint: "#CDE8D5",
} as const;
export type TapeColor = keyof typeof tape;

// Time-of-day sky gradients (top → middle → bottom). Mirrors DESIGN.md → Color.
export const skies = {
  dawn: ["#2B3A67", "#C77D9B", "#FFB38A"],
  day: ["#4FA9D6", "#7EC8E3", "#D7EEF5"],
  goldenHour: ["#6A5A9E", "#FF8C69", "#F5D7A1"],
  dusk: ["#1C2552", "#6B4A7E", "#D9787A"],
  night: ["#030C16", "#071A2B", "#123A55"],
} as const;
export type SkyName = keyof typeof skies;

// March 29 — anniversary sunset (all day on the anniversary): deeper violet →
// coral → peach than golden hour, with the sun resting low on the horizon.
export const anniversarySky = ["#3A1E52", "#D9507A", "#FF9E6D"] as const;
export const anniversary = {
  lantern: "#FFB86B",
  lanternGlow: "#FFD9A0",
  lanternFrame: "#C0613A",
  stone: "#CFC2B0",
  stoneShadow: "#A89A87",
  stoneInk: "#6E5F52",
  sandWriting: "#D9AE6E", // finger-drawn letters (darker than scene.sand)
} as const;

// Keyframes the beach blends between smoothly, by local hour (0–24).
// Between two keyframes the colors are interpolated; the list wraps at midnight.
export const skyKeyframes: { hour: number; sky: SkyName }[] = [
  { hour: 0, sky: "night" },
  { hour: 4.5, sky: "night" },
  { hour: 6, sky: "dawn" },
  { hour: 8, sky: "day" },
  { hour: 16.5, sky: "day" },
  { hour: 18, sky: "goldenHour" },
  { hour: 19.3, sky: "dusk" },
  { hour: 20.5, sky: "night" },
  { hour: 24, sky: "night" },
];

export function skyForHour(hour: number): SkyName {
  if (hour >= 5 && hour < 7.5) return "dawn";
  if (hour >= 7.5 && hour < 17) return "day";
  if (hour >= 17 && hour < 19) return "goldenHour";
  if (hour >= 19 && hour < 20.5) return "dusk";
  return "night";
}

// Cut-paper beach scene colors (Phase 2). Derived from the core palette.
export const scene = {
  seaDeep: "#0E4F63",
  sea: "#126E82",
  seaLight: "#3E9CB0",
  seaShallow: "#7EC8E3",
  foam: "#FFF8EF",
  sand: "#F5D7A1",
  sandLight: "#FAE6C0",
  sandShadow: "#E2BD80",
  footprint: "#DDB57A",
  palmTrunk: "#B07A48",
  palmTrunkDark: "#8C5A31",
  palmLeaf: "#3E8C6A",
  palmLeafDark: "#2C6B50",
  wood: "#C08A57",
  woodDark: "#8C5A31",
  sun: "#FFD27A",
  moon: "#FFF4D6",
  cloud: "#FFF8EF",
  towelA: "#FF8C69",
  towelB: "#FFF8EF",
  fire: "#FF8C69",
  fireCore: "#FFD27A",
  bulb: "#FFE3A3",
  hutRoof: "#B7864F",
  hutWall: "#E8C28C",
  shells: ["#FFB4A8", "#F5D7A1", "#BFE3F0", "#CDE8D5", "#FF8C69"],
  shellPlain: "#F3E2C4",
  starfish: "#FF8C69",
} as const;
