import type { ViewStyle } from "react-native";
import { colors } from "./colors";

// Warm shadows only (sunburnt brown, never grey). Mirrors DESIGN.md.
function shadow(y: number, blur: number, opacity: number, elevation: number): ViewStyle {
  return {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: y },
    shadowRadius: blur / 2,
    shadowOpacity: opacity,
    elevation,
  };
}

export const shadows = {
  lifted: shadow(2, 6, 0.12, 2),
  paper: shadow(4, 12, 0.14, 4),
  floating: shadow(10, 24, 0.2, 10),
} as const;
