import { Body, Icon3D, successHaptic, tapHaptic, Title } from "@/components/ui";
import { colors, radius, scene, shadows, space } from "@/theme";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
    Easing,
    FadeIn,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withTiming,
} from "react-native-reanimated";
import Svg, { Ellipse, Path, Rect } from "react-native-svg";
import { SparkleBurst } from "./effects";

// ---- Throw: the bottle arcs from the shore into the sea, splash + ripple ----

export function BottleThrow({ toJar, onDone }: { toJar: boolean; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? 1 : 0);
  const ripple = useSharedValue(0);
  const [landed, setLanded] = useState(reduceMotion);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seaY = height * 0.42;
  const from = { x: width * 0.2, y: height * 0.78 };
  const to = { x: width * 0.7, y: seaY };

  const finish = () => {
    timers.current.forEach(clearTimeout);
    t.value = 1;
    setLanded(true);
    timers.current = [setTimeout(onDone, 900)];
  };

  useEffect(() => {
    if (reduceMotion) {
      timers.current.push(setTimeout(onDone, 1600));
      return () => timers.current.forEach(clearTimeout);
    }
    tapHaptic();
    t.value = withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) });
    timers.current.push(
      setTimeout(() => {
        setLanded(true);
        successHaptic();
        ripple.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
      }, 1100),
      setTimeout(onDone, 2900),
    );
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bottle = useAnimatedStyle(() => {
    const x = from.x + (to.x - from.x) * t.value;
    const arc = -Math.sin(Math.PI * t.value) * height * 0.28;
    const y = from.y + (to.y - from.y) * t.value + arc;
    return {
      opacity: t.value >= 1 ? 0 : 1,
      transform: [{ translateX: x - 24 }, { translateY: y - 24 }, { rotate: `${t.value * 540}deg` }, { scale: 1 - t.value * 0.45 }],
    };
  });
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: 1 - ripple.value,
    transform: [{ scale: 0.3 + ripple.value * 1.6 }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(250)} style={[StyleSheet.absoluteFill, styles.throwRoot]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={finish} accessibilityRole="button" accessibilityLabel="Skip">
        {/* simple sea + sand backdrop */}
        <View style={[styles.sea, { top: seaY - 40 }]} />
        <View style={[styles.sand, { top: height * 0.7 }]} />
        {!toJar && (
          <Animated.View style={[styles.abs, { left: to.x - 60, top: to.y - 20 }, rippleStyle]} pointerEvents="none">
            <Svg width={120} height={40}>
              <Ellipse cx={60} cy={20} rx={56} ry={16} stroke={scene.foam} strokeWidth={3} fill="none" />
              <Ellipse cx={60} cy={20} rx={30} ry={8} stroke={scene.foam} strokeWidth={2} fill="none" />
            </Svg>
          </Animated.View>
        )}
        {landed && !toJar && !reduceMotion && <SparkleBurst x={to.x} y={to.y - 10} seed="splash" />}
        {!toJar ? (
          <Animated.View style={[styles.abs, { left: 0, top: 0 }, bottle]} pointerEvents="none">
            <Icon3D name="bottle" size={48} />
          </Animated.View>
        ) : null}
        {toJar && (
          <View style={[styles.abs, { left: width / 2 - 48, top: seaY + 20 }]}>
            <Icon3D name="loveLetter" size={96} />
          </View>
        )}
        {(landed || toJar) && (
          <Animated.View entering={FadeIn.duration(500)} style={[styles.caption, { top: height * 0.2 }]}>
            <Title variant="titleItalic" color={colors.onDark} center>
              {toJar ? "It's in the jar 🫙" : "On its way 🌊"}
            </Title>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ---- Unroll: the cork pops, the paper unrolls, then the letter shows ----

export function BottleUnroll({ label, onDone }: { label: string; onDone: () => void }) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const cork = useSharedValue(0);
  const paper = useSharedValue(0);
  const veil = useSharedValue(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const W = Math.min(width * 0.7, 280);

  const finish = () => {
    timers.current.forEach(clearTimeout);
    cork.value = 1;
    paper.value = 1;
    veil.value = withTiming(0, { duration: 400 });
    timers.current = [setTimeout(onDone, 420)];
  };

  useEffect(() => {
    if (reduceMotion) {
      timers.current.push(setTimeout(finish, 900));
      return () => timers.current.forEach(clearTimeout);
    }
    cork.value = withDelay(500, withTiming(1, { duration: 600, easing: Easing.out(Easing.back(2)) }));
    paper.value = withDelay(1200, withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }));
    timers.current.push(
      setTimeout(successHaptic, 600),
      setTimeout(() => (veil.value = withTiming(0, { duration: 600 })), 2500),
      setTimeout(onDone, 3150),
    );
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const corkStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -cork.value * 90 }, { translateX: cork.value * 30 }, { rotate: `${cork.value * 200}deg` }],
    opacity: 1 - Math.max(0, cork.value - 0.7) / 0.3,
  }));
  const bottleStyle = useAnimatedStyle(() => ({ opacity: 1 - paper.value * 0.8, transform: [{ translateY: paper.value * 40 }] }));
  const paperStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: 0.04 + paper.value * 0.96 }], opacity: paper.value > 0 ? 1 : 0 }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.unrollRoot, veilStyle]}>
      <Pressable style={styles.center} onPress={finish} accessibilityRole="button" accessibilityLabel="Skip">
        <Body color={colors.onDarkSoft} center style={styles.unrollLabel}>
          {label}
        </Body>
        <View style={{ width: W, height: W * 1.1, alignItems: "center" }}>
          <Animated.View style={[styles.abs, { top: W * 0.35 }, bottleStyle]}>
            <Svg width={90} height={150} viewBox="0 0 90 150">
              <Rect x={33} y={8} width={24} height={30} rx={6} fill="#BFE3F0" opacity={0.85} />
              <Path d="M33 36 C10 50 8 70 8 90 L8 138 C8 146 14 150 22 150 L68 150 C76 150 82 146 82 138 L82 90 C82 70 80 50 57 36 Z" fill="#BFE3F0" opacity={0.75} />
              <Rect x={20} y={70} width={50} height={60} rx={4} fill={colors.warmWhite} opacity={0.9} />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.abs, { top: W * 0.35 - 4, left: W / 2 - 13 }, corkStyle]}>
            <Svg width={26} height={20}>
              <Rect x={0} y={0} width={26} height={20} rx={5} fill={scene.wood} />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.paper, { width: W, height: W * 1.05, transformOrigin: "50% 0%" }, paperStyle]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  throwRoot: { backgroundColor: colors.deepOcean, zIndex: 40 },
  sea: { position: "absolute", left: 0, right: 0, height: 260, backgroundColor: scene.sea },
  sand: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: scene.sand },
  caption: { position: "absolute", left: space.xl, right: space.xl },
  unrollRoot: { backgroundColor: colors.deepOcean, zIndex: 30 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  unrollLabel: { marginBottom: space.xl },
  paper: { position: "absolute", top: 0, backgroundColor: colors.warmWhite, borderRadius: radius.photo, ...shadows.floating },
});
