import { Body, Handwritten, successHaptic } from "@/components/ui";
import { colors, radius, shadows, space } from "@/theme";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

const DEVELOP_MS = 3000;
const TYPE_MS = 55; // per character
const HOLD_MS = 900; // pause on the finished polaroid before moving on

// After saving a memory: its first photo develops in a polaroid (milky white →
// warm → true colour over ~3s) while the title writes itself in Caveat.
// Tap to skip. Reduce Motion: the finished polaroid fades in, then continues.
export function PolaroidDevelop({
  uri,
  cacheKey,
  title,
  onDone,
}: {
  uri: string | null;
  cacheKey?: string | null;
  title: string;
  onDone: () => void;
}) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const frame = Math.min(width * 0.72, 300);
  const photo = frame - 24;

  const develop = useSharedValue(reduceMotion ? 1 : 0);
  const [typed, setTyped] = useState(reduceMotion ? title.length : 0);
  const finished = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const typer = useRef<ReturnType<typeof setInterval> | null>(null);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    timers.current.forEach(clearTimeout);
    if (typer.current) clearInterval(typer.current);
    develop.value = 1;
    setTyped(title.length);
    successHaptic();
    timers.current = [setTimeout(onDone, HOLD_MS)];
  };

  useEffect(() => {
    if (reduceMotion) {
      timers.current.push(setTimeout(finish, 1200));
    } else {
      develop.value = withTiming(1, { duration: DEVELOP_MS, easing: Easing.inOut(Easing.quad) });
      const typeStart = setTimeout(() => {
        typer.current = setInterval(() => {
          setTyped((n) => {
            if (n >= title.length && typer.current) clearInterval(typer.current);
            return Math.min(title.length, n + 1);
          });
        }, TYPE_MS);
      }, DEVELOP_MS * 0.45);
      timers.current.push(typeStart, setTimeout(finish, Math.max(DEVELOP_MS, DEVELOP_MS * 0.45 + title.length * TYPE_MS) + 150));
    }
    return () => {
      timers.current.forEach(clearTimeout);
      if (typer.current) clearInterval(typer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // milky white veil fades out; a warm cast lingers a little longer, then neutral
  const milk = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, develop.value * 1.3) }));
  const warm = useAnimatedStyle(() => ({ opacity: 0.35 * (1 - develop.value) }));
  const image = useAnimatedStyle(() => ({ opacity: Math.min(1, develop.value * 1.6) }));

  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(400)} style={styles.root}>
      <Pressable style={styles.center} onPress={finish} accessibilityRole="button" accessibilityLabel="Skip">
        <View style={[styles.frame, { width: frame }]}>
          <View style={{ width: photo, height: photo, backgroundColor: colors.paperDeep, overflow: "hidden" }}>
            {uri ? (
              <Animated.View style={[StyleSheet.absoluteFill, image]}>
                <Image source={cacheKey ? { uri, cacheKey } : { uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              </Animated.View>
            ) : null}
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.sunset }, warm]} />
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#F7F4EE" }, milk]} />
          </View>
          <Handwritten center numberOfLines={2} style={styles.caption}>
            {title.slice(0, typed)}
            {typed < title.length ? " " : ""}
          </Handwritten>
        </View>
        <Body variant="small" color={colors.onDarkSoft} style={styles.hint}>
          Saved to your story
        </Body>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(7,26,43,0.82)", zIndex: 60 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  frame: {
    backgroundColor: colors.warmWhite,
    padding: 12,
    paddingBottom: space.md,
    borderRadius: radius.photo,
    transform: [{ rotate: "-2deg" }],
    ...shadows.floating,
  },
  caption: { marginTop: space.md, minHeight: 30 },
  hint: { marginTop: space.xl },
});
