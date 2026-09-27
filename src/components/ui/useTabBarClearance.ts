import { space, TAB_BAR_HEIGHT } from "@/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Bottom padding a tab screen needs so its content clears the floating tab bar
// (the bar sits max(insets.bottom, 12) above the screen edge).
export function useTabBarClearance() {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, space.md) + TAB_BAR_HEIGHT + space.lg;
}
