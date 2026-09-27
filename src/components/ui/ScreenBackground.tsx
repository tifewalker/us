import { colors, GUTTER } from "@/theme";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PaperTexture } from "./PaperTexture";
import { useTabBarClearance } from "./useTabBarClearance";

type Props = {
  children: ReactNode;
  variant?: "paper" | "gradient";
  // Gradient stops (top → bottom) for variant="gradient". Defaults to a warm dusk.
  gradient?: readonly [string, string, ...string[]];
  // Pad content by the safe area + gutter. Turn off for full-bleed screens
  // (e.g. those that manage their own ScrollView padding).
  padded?: boolean;
  // Tab screens: pad the bottom so content clears the floating tab bar.
  aboveTabBar?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Page background: grainy paper, or a gradient (sky / dusk). Safe-area aware.
export function ScreenBackground({
  children,
  variant = "paper",
  gradient = [colors.deepOcean, colors.ocean, colors.sand],
  padded = true,
  aboveTabBar = false,
  style,
}: Props) {
  const insets = useSafeAreaInsets();
  const tabClearance = useTabBarClearance();
  return (
    <View style={[styles.root, variant === "paper" && { backgroundColor: colors.paper }]}>
      {variant === "paper" ? (
        <PaperTexture />
      ) : (
        <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
      )}
      <View
        style={[
          styles.content,
          padded && {
            paddingTop: insets.top + 12,
            paddingBottom: aboveTabBar ? tabClearance : insets.bottom + 12,
            paddingHorizontal: GUTTER,
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.deepOcean },
  content: { flex: 1 },
});
