import { seededUnit } from "@/components/ui/seeded";
import { colors, scene } from "@/theme";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useLoop } from "@/components/beach/useLoop";

// ---- Sparkle burst (chapter unlock) ------------------------------------------

const SPARKLE = "M6 0 L7.4 4.6 L12 6 L7.4 7.4 L6 12 L4.6 7.4 L0 6 L4.6 4.6 Z";

// A gentle one-shot burst of 8 little sparkles radiating from (x, y).
// Reduce Motion: nothing (the chapter card's fade already marks the moment).
export function SparkleBurst({ x, y, seed = "burst", delay = 0 }: { x: number; y: number; seed?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill]}>
      {Array.from({ length: 8 }, (_, i) => (
        <Sparkle key={i} x={x} y={y} index={i} seed={seed} delay={delay} />
      ))}
    </View>
  );
}

function Sparkle({ x, y, index, seed, delay }: { x: number; y: number; index: number; seed: string; delay: number }) {
  const t = useSharedValue(0);
  const angle = (Math.PI * 2 * index) / 8 + seededUnit(seed, index) * 0.5;
  const dist = 34 + seededUnit(seed, index + 20) * 30;
  const size = 10 + seededUnit(seed, index + 40) * 8;
  useEffect(() => {
    t.value = withDelay(delay + index * 40, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [t, delay, index]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.2 ? t.value * 5 : 1 - (t.value - 0.2) / 0.8,
    transform: [
      { translateX: Math.cos(angle) * dist * t.value },
      { translateY: Math.sin(angle) * dist * t.value },
      { scale: 0.4 + 0.8 * Math.sin(Math.PI * Math.min(t.value * 1.2, 1)) },
    ],
  }));
  return (
    <Animated.View style={[styles.abs, { left: x - size / 2, top: y - size / 2 }, style]}>
      <Svg width={size} height={size} viewBox="0 0 12 12">
        <Path d={SPARKLE} fill={index % 3 === 0 ? colors.warmWhite : scene.sun} />
      </Svg>
    </Animated.View>
  );
}

// ---- Floating hearts (the reveal) ---------------------------------------------

const HEART = "M12 21 C12 21 2 14.5 2 8 C2 4.7 4.6 2.5 7.4 2.5 C9.4 2.5 11 3.7 12 5.3 C13 3.7 14.6 2.5 16.6 2.5 C19.4 2.5 22 4.7 22 8 C22 14.5 12 21 12 21 Z";

// 12 small coral hearts drifting up from the bottom of `height` and fading.
export function FloatingHearts({ width, height, count = 12 }: { width: number; height: number; count?: number }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, i) => (
        <Heart key={i} index={i} width={width} height={height} />
      ))}
    </View>
  );
}

function Heart({ index, width, height }: { index: number; width: number; height: number }) {
  const t = useSharedValue(0);
  const seed = `heart-${index}`;
  const x = width * (0.1 + 0.8 * seededUnit(seed, 1));
  const size = 14 + seededUnit(seed, 2) * 12;
  const sway = (seededUnit(seed, 3) - 0.5) * 50;
  useEffect(() => {
    t.value = withDelay(index * 110, withTiming(1, { duration: 2200 + seededUnit(seed, 4) * 800, easing: Easing.out(Easing.quad) }));
  }, [t, index, seed]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.15 ? t.value / 0.15 : 1 - (t.value - 0.15) / 0.85,
    transform: [{ translateY: -height * 0.8 * t.value }, { translateX: sway * Math.sin(t.value * Math.PI) }],
  }));
  return (
    <Animated.View style={[styles.abs, { left: x, top: height - size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={HEART} fill={colors.coral} />
      </Svg>
    </Animated.View>
  );
}

// ---- Paper boat drifting on a wave line (waiting for your partner) ------------

export function PaperBoat({ width, active = true }: { width: number; active?: boolean }) {
  const reduceMotion = useReducedMotion();
  const run = active && !reduceMotion;
  const drift = useLoop(9000, run, { reverse: true });
  const bob = useLoop(1800, run, { reverse: true });
  const wave = useLoop(4000, run);
  const boatStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (drift.value - 0.5) * width * 0.35 },
      { translateY: bob.value * 5 },
      { rotate: `${(bob.value - 0.5) * 8}deg` },
    ],
  }));
  const waveStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -wave.value * 60 }] }));
  const w = width + 60;
  let d = "M0 14";
  for (let x = 0; x < w; x += 60) d += ` Q${x + 15} 6 ${x + 30} 14 T${x + 60} 14`;
  return (
    <View style={{ width, height: 70, overflow: "hidden" }} pointerEvents="none">
      <Animated.View style={[styles.boat, { left: width / 2 - 28 }, boatStyle]}>
        <Svg width={56} height={40} viewBox="0 0 56 40">
          <Path d="M2 22 L54 22 L44 36 L12 36 Z" fill={colors.warmWhite} stroke={colors.paperEdge} strokeWidth={1.5} />
          <Path d="M24 22 L32 2 L40 22 Z" fill={colors.paper} stroke={colors.paperEdge} strokeWidth={1.5} />
          <Path d="M16 22 L24 8 L28 22 Z" fill={colors.paperDeep} stroke={colors.paperEdge} strokeWidth={1.5} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.wave, waveStyle]}>
        <Svg width={w} height={28}>
          <Path d={d} stroke={scene.seaLight} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  boat: { position: "absolute", top: 8 },
  wave: { position: "absolute", left: 0, top: 36 },
});
