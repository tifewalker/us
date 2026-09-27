import { colors, radius, shadows, space } from "@/theme";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { PaperTexture } from "./PaperTexture";

// A raised sheet of paper. Use sparingly — most content sits directly on the page.
export function PaperCard({
  children,
  style,
  tint = colors.warmWhite,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: string;
}) {
  return (
    <View style={[styles.card, { backgroundColor: tint }, style]}>
      <View style={styles.clip} pointerEvents="none">
        <PaperTexture opacity={0.7} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.paper,
    padding: space.lg,
    ...shadows.paper,
  },
  clip: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.paper,
    overflow: "hidden",
  },
});
