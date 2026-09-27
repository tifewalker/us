import { seededUnit } from "@/components/ui/seeded";
import { anniversary, anniversarySky, fonts } from "@/theme";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Ellipse, Path, Rect } from "react-native-svg";
import { useLoop } from "./useLoop";

// Anniversary mode (March 29 — relationship_start's month/day): the sunset
// palette for <Sky sunset>, paper lanterns rising over the sea, words written
// in the sand, and the year stones (permanent — shown every day after).

export const ANNIVERSARY_SUNSET = { colors: anniversarySky, sunT: 0.9 } as const;

// ---- paper lanterns ----------------------------------------------------------------

// 6–10 lanterns rise from the shore over the sea and fade into the sky, each on
// its own slow, staggered loop. Reduce Motion / paused: they hang still in the
// sky (their seeded starting point). Web: fewer.
export function Lanterns({
  W,
  horizonY,
  shoreY,
  topY,
  active,
}: {
  W: number;
  horizonY: number;
  shoreY: number;
  topY: number;
  active: boolean;
}) {
  const count = Platform.OS === "web" ? 6 : 9;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, i) => (
        <Lantern key={i} index={i} W={W} fromY={Math.max(shoreY - 6, horizonY)} toY={topY} active={active} />
      ))}
    </View>
  );
}

function Lantern({ index, W, fromY, toY, active }: { index: number; W: number; fromY: number; toY: number; active: boolean }) {
  const seed = `lantern-${index}`;
  const x = W * (0.08 + seededUnit(seed, 1) * 0.84);
  const size = 16 + seededUnit(seed, 2) * 10;
  // when still, they sit spread across the sky (0.35–0.85 of the way up)
  const rise = useLoop(16000 + seededUnit(seed, 3) * 9000, active, { initial: 0.35 + seededUnit(seed, 4) * 0.5, delay: index * 700 });
  const sway = useLoop(2600 + seededUnit(seed, 5) * 1400, active, { reverse: true });
  const style = useAnimatedStyle(() => {
    const p = rise.value;
    const y = fromY + (toY - fromY) * p;
    // fade in off the shore, fade out near the top
    const opacity = Math.min(1, p * 6) * (1 - Math.max(0, (p - 0.8) / 0.2));
    const scale = 1 - p * 0.45; // farther = smaller
    return {
      opacity,
      transform: [{ translateY: y - size }, { translateX: (sway.value - 0.5) * 14 }, { scale }],
    };
  });
  return (
    <Animated.View style={[styles.abs, { left: x - size / 2, top: 0, width: size, height: size * 1.4 }, style]}>
      <Svg width={size} height={size * 1.4} viewBox="0 0 20 28">
        <Ellipse cx={10} cy={13} rx={12} ry={13} fill={anniversary.lanternGlow} opacity={0.35} />
        <Path d="M4 6 Q10 3 16 6 L17 20 Q10 23 3 20 Z" fill={anniversary.lantern} />
        <Path d="M4 6 Q10 3 16 6" stroke={anniversary.lanternFrame} strokeWidth={1.2} fill="none" />
        <Path d="M3 20 Q10 23 17 20" stroke={anniversary.lanternFrame} strokeWidth={1.2} fill="none" />
        <Rect x={8} y={21} width={4} height={3} rx={1} fill={anniversary.lanternGlow} />
      </Svg>
    </Animated.View>
  );
}

// ---- writing in the sand -----------------------------------------------------------------

// "3 years of us" as if drawn with a finger: Caveat in a sand tone with a light
// edge below-right and a darker groove above-left (a soft inset look).
export function SandWriting({ text, x, y, maxWidth }: { text: string; x: number; y: number; maxWidth: number }) {
  return (
    <View pointerEvents="none" style={[styles.abs, { left: x, top: y, width: maxWidth, transform: [{ rotate: "-4deg" }] }]} accessibilityLabel={text}>
      <Text style={[styles.sand, styles.sandLight]} numberOfLines={1}>
        {text}
      </Text>
      <Text style={[styles.sand, styles.sandGroove]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

// ---- year stones ---------------------------------------------------------------------------

// A little row of engraved stones, one per anniversary reached ("1", "2", …),
// wrapping if there are many. Permanent (couple_world.unlocked_items).
export function YearStones({ count, left, top, maxWidth }: { count: number; left: number; top: number; maxWidth: number }) {
  if (count <= 0) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.abs, styles.stones, { left, top, maxWidth }]}
      accessibilityLabel={`${count} year ${count === 1 ? "stone" : "stones"}`}
    >
      {Array.from({ length: count }, (_, i) => (
        <YearStone key={i} n={i + 1} />
      ))}
    </View>
  );
}

export function YearStone({ n, size = 26 }: { n: number; size?: number }) {
  const tilt = (seededUnit(`stone-${n}`, 1) - 0.5) * 16;
  return (
    <View style={{ width: size, height: size * 0.78, transform: [{ rotate: `${tilt}deg` }] }}>
      <Svg width={size} height={size * 0.78} viewBox="0 0 26 20" style={StyleSheet.absoluteFill}>
        <Ellipse cx={13.5} cy={11.5} rx={12} ry={8} fill={anniversary.stoneShadow} />
        <Ellipse cx={13} cy={10} rx={12} ry={8} fill={anniversary.stone} />
        <Ellipse cx={9} cy={7} rx={4} ry={2} fill="#FFFFFF" opacity={0.25} />
      </Svg>
      <Text style={[styles.stoneText, { fontSize: size * 0.42, lineHeight: size * 0.78 }]}>{n}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  sand: { fontFamily: fonts.hand, fontSize: 30, lineHeight: 34 },
  sandLight: { position: "absolute", left: 1, top: 1.5, color: "rgba(255,248,239,0.55)" },
  sandGroove: { color: anniversary.sandWriting, opacity: 0.9 },
  stones: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  stoneText: { position: "absolute", left: 0, right: 0, top: 0, textAlign: "center", fontFamily: fonts.bodyBold, color: anniversary.stoneInk },
});
