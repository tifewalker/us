import { colors, fonts, shadows } from "@/theme";
import { Image } from "expo-image";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

// A round profile photo in a warmWhite ring. No photo: the first letter of
// the name in Fraunces italic on sand.
export function Avatar({
  url,
  cacheKey,
  name,
  size = 48,
  style,
}: {
  url?: string | null;
  cacheKey?: string | null; // the storage path (signed URLs change)
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const ring = Math.max(2, Math.round(size / 18));
  const initial = (name?.trim()[0] ?? "♡").toUpperCase();
  return (
    <View
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2, padding: ring }, style]}
      accessibilityLabel={name ? `${name}'s photo` : "Profile photo"}
    >
      {url ? (
        <Image source={{ uri: url, cacheKey: cacheKey ?? undefined }} style={[styles.fill, { borderRadius: size / 2 }]} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.fill, styles.empty, { borderRadius: size / 2 }]}>
          <Text style={[styles.initial, { fontSize: size * 0.42, lineHeight: size * 0.52 }]}>{initial}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { backgroundColor: colors.warmWhite, ...shadows.lifted },
  fill: { flex: 1, overflow: "hidden" },
  empty: { backgroundColor: colors.sand, alignItems: "center", justifyContent: "center" },
  initial: { fontFamily: fonts.headingItalic, color: colors.inkOcean },
});
