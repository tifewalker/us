import { PressableScale } from "@/components/ui";
import { colors, radius, shadows } from "@/theme";
import { router } from "expo-router";
import { StyleSheet, Text } from "react-native";

export function BackButton() {
  return (
    <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
      <Text style={styles.text}>‹</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.warmWhite, alignItems: "center", justifyContent: "center", ...shadows.lifted },
  text: { color: colors.inkOcean, fontSize: 22, lineHeight: 26, fontWeight: "700" },
});
