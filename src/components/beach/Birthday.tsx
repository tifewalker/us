import { Icon3D, PressableScale, tapHaptic } from "@/components/ui";
import { seededUnit } from "@/components/ui/seeded";
import { colors, radius, shadows, space, type as typeScale } from "@/theme";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import Svg, { Ellipse, Path } from "react-native-svg";
import { useLoop } from "./useLoop";

const BALLOON_COLORS = [colors.coral, colors.sky, colors.sand, colors.sunset];

// Birthday mode: a cluster of balloons tied to a point (the palm trunk), bobbing.
export function Balloons({ x, y, active }: { x: number; y: number; active: boolean }) {
  const bob = useLoop(3000, active, { reverse: true });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: (bob.value - 0.5) * 8 }, { rotate: `${(bob.value - 0.5) * 4}deg` }],
  }));
  const W = 110;
  const H = 150;
  const balloons = [
    { cx: 30, cy: 34, c: 0 },
    { cx: 62, cy: 22, c: 1 },
    { cx: 86, cy: 44, c: 2 },
    { cx: 50, cy: 58, c: 3 },
  ];
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { left: x - W / 2, top: y - H, width: W, height: H, transformOrigin: "50% 100%" }, style]}>
      <Svg width={W} height={H}>
        {balloons.map((b, i) => (
          <Path key={`s${i}`} d={`M${b.cx} ${b.cy + 20} Q${(b.cx + W / 2) / 2 + 6} ${H * 0.7} ${W / 2} ${H}`} stroke="#6E5F52" strokeWidth={1} fill="none" opacity={0.7} />
        ))}
        {balloons.map((b, i) => (
          <Ellipse key={`b${i}`} cx={b.cx} cy={b.cy} rx={17} ry={20} fill={BALLOON_COLORS[b.c]} />
        ))}
        {balloons.map((b, i) => (
          <Ellipse key={`h${i}`} cx={b.cx - 6} cy={b.cy - 8} rx={4} ry={6} fill="#FFFFFF" opacity={0.35} />
        ))}
      </Svg>
    </Animated.View>
  );
}

// Bunting (little paper flags) hung in a curve between two points.
export function Bunting({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const left = Math.min(from.x, to.x);
  const top = Math.min(from.y, to.y);
  const w = Math.abs(to.x - from.x);
  const h = Math.abs(to.y - from.y) + 60;
  const a = { x: from.x - left, y: from.y - top };
  const b = { x: to.x - left, y: to.y - top };
  const ctrl = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + 40 };
  const flags = Array.from({ length: 9 }, (_, i) => {
    const t = (i + 1) / 10;
    return {
      x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * ctrl.x + t * t * b.x,
      y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * ctrl.y + t * t * b.y,
      c: BALLOON_COLORS[i % BALLOON_COLORS.length],
    };
  });
  return (
    <View pointerEvents="none" style={[styles.abs, { left, top, width: w, height: h }]}>
      <Svg width={w} height={h}>
        <Path d={`M${a.x} ${a.y} Q${ctrl.x} ${ctrl.y} ${b.x} ${b.y}`} stroke="#6E5F52" strokeWidth={1.2} fill="none" opacity={0.6} />
        {flags.map((f, i) => (
          <Path key={i} d={`M${f.x - 8} ${f.y} L${f.x + 8} ${f.y} L${f.x} ${f.y + 16} Z`} fill={f.c} />
        ))}
      </Svg>
    </View>
  );
}

// A few petals drifting down. Reduce Motion / paused: they rest in place.
export function Petals({ width, height, active }: { width: number; height: number; active: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: Platform.OS === "web" ? 5 : 8 }, (_, i) => (
        <Petal key={i} index={i} width={width} height={height} active={active} />
      ))}
    </View>
  );
}

function Petal({ index, width, height, active }: { index: number; width: number; height: number; active: boolean }) {
  const seed = `petal-${index}`;
  const x = seededUnit(seed, 1) * width;
  const fall = useLoop(9000 + seededUnit(seed, 2) * 6000, active, { initial: seededUnit(seed, 3) });
  const sway = useLoop(2400 + seededUnit(seed, 4) * 1200, active, { reverse: true });
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -40 + fall.value * (height + 80) },
      { translateX: (sway.value - 0.5) * 36 },
      { rotate: `${fall.value * 540}deg` },
    ],
  }));
  return (
    <Animated.View style={[styles.abs, { left: x, top: 0 }, style]}>
      <Svg width={12} height={14} viewBox="0 0 12 14">
        <Path d="M6 0 C10 3 12 8 6 14 C0 8 2 3 6 0 Z" fill={index % 2 ? "#FFB4A8" : "#FFD9CF"} />
      </Svg>
    </Animated.View>
  );
}

// Cake sticker on the towel (birthday mode).
export function CakeSticker({ x, y }: { x: number; y: number }) {
  return (
    <View pointerEvents="none" style={[styles.abs, { left: x, top: y, transform: [{ rotate: "-8deg" }] }]}>
      <Icon3D name="cake" size={44} />
    </View>
  );
}

// The wrapped gift on the recipient's beach. Locked: "Something is waiting for
// you… N days" — tapping only shakes it (with a haptic); content is never
// fetched. Unlocked: it glows and says "Open your gift".
export function GiftSticker({
  left,
  top,
  daysLeft,
  unlocked,
  active,
  onOpen,
}: {
  left: number;
  top: number;
  daysLeft: number;
  unlocked: boolean;
  active: boolean;
  onOpen: () => void;
}) {
  const shake = useSharedValue(0);
  const glow = useLoop(1800, active && unlocked, { reverse: true });
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${shake.value * 10}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: unlocked ? 0.35 + glow.value * 0.45 : 0, transform: [{ scale: 1 + glow.value * 0.15 }] }));

  function press() {
    if (unlocked) return onOpen();
    tapHaptic();
    shake.value = withSequence(
      withTiming(-1, { duration: 70 }),
      withTiming(1, { duration: 90 }),
      withTiming(-0.7, { duration: 80 }),
      withTiming(0.5, { duration: 80 }),
      withTiming(0, { duration: 70 }),
    );
  }

  const label = unlocked
    ? "Open your gift"
    : daysLeft <= 0
      ? "Something is waiting for you…"
      : `Something is waiting for you… ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`;

  return (
    <PressableScale onPress={press} haptic={unlocked} accessibilityRole="button" accessibilityLabel={label} style={[styles.abs, styles.giftRow, { left, top }]}>
      <View>
        <Animated.View style={[styles.glow, glowStyle]} />
        <Animated.View style={shakeStyle}>
          <Icon3D name="gift" size={50} />
        </Animated.View>
      </View>
      <View style={[styles.bubble, unlocked && styles.bubbleHot]}>
        <Text style={[typeScale.small, styles.bubbleText]} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  giftRow: { flexDirection: "row", alignItems: "center", gap: 2, maxWidth: 220 },
  glow: { position: "absolute", left: -8, top: -8, width: 66, height: 66, borderRadius: 33, backgroundColor: colors.sand },
  bubble: {
    flexShrink: 1,
    backgroundColor: colors.warmWhite,
    borderRadius: radius.badge,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    ...shadows.lifted,
  },
  bubbleHot: { backgroundColor: colors.sand },
  bubbleText: { color: colors.inkOcean, fontSize: 12, lineHeight: 16 },
});
