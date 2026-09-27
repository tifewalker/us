import { colors } from "@/theme";
import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

const VINYL = "#1E1A17";

// A vinyl record with the cover art as its label. Spins while `spinning`,
// holds its angle when paused; never spins with Reduce Motion on.
export function VinylRecord({
  size,
  artworkUrl,
  spinning = false,
}: {
  size: number;
  artworkUrl: string | null;
  spinning?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const angle = useSharedValue(0);

  useEffect(() => {
    if (spinning && !reduceMotion) {
      // Continue from the current angle, one turn every 3.2s.
      const from = angle.value % 360;
      angle.value = from;
      angle.value = withRepeat(withTiming(from + 360, { duration: 3200, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(angle);
    }
    return () => cancelAnimation(angle);
  }, [spinning, reduceMotion, angle]);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  const label = size * 0.42;

  return (
    <Animated.View style={[{ width: size, height: size }, spin]}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={VINYL} />
        {/* grooves */}
        {[0.46, 0.4, 0.34, 0.28].map((r) => (
          <Circle key={r} cx={size / 2} cy={size / 2} r={size * r} stroke="#FFFFFF" strokeOpacity={0.07} strokeWidth={1} fill="none" />
        ))}
        {/* sheen */}
        <Circle cx={size * 0.35} cy={size * 0.3} r={size * 0.18} fill="#FFFFFF" opacity={0.05} />
      </Svg>
      <View style={[styles.label, { width: label, height: label, borderRadius: label / 2, left: (size - label) / 2, top: (size - label) / 2 }]}>
        {artworkUrl ? (
          <Image source={{ uri: artworkUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : null}
        <View style={[styles.hole, { width: size * 0.05, height: size * 0.05, borderRadius: size * 0.025 }]} />
      </View>
    </Animated.View>
  );
}

// Tiny record for list badges (e.g. story clusters that have a song).
export function VinylBadge({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} accessibilityLabel="Has a song">
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={VINYL} />
      <Circle cx={size / 2} cy={size / 2} r={size * 0.36} stroke="#FFFFFF" strokeOpacity={0.12} strokeWidth={0.8} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={size * 0.2} fill={colors.sunset} />
      <Circle cx={size / 2} cy={size / 2} r={size * 0.05} fill={VINYL} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  label: {
    position: "absolute",
    overflow: "hidden",
    backgroundColor: colors.sunset,
    alignItems: "center",
    justifyContent: "center",
  },
  hole: { backgroundColor: VINYL },
});
