import { useBeachLayout } from "@/components/beach/layout";
import { Palm } from "@/components/beach/Palm";
import { Sand } from "@/components/beach/Sand";
import { Sea } from "@/components/beach/Sea";
import { Sky } from "@/components/beach/Sky";
import { useLoop } from "@/components/beach/useLoop";
import { Body, Button, formatLongDate, Handwritten, tapHaptic, Title, WashiTape } from "@/components/ui";
import { colors, radius, scene, shadows, space } from "@/theme";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

// Beat timings (ms from start). ~13s calm pacing; tap anywhere to jump to the end.
const BEATS = { title: 700, beach: 3000, date: 6500, line: 8500, note: 10500 };
const SUN_FROM = 5.0; // dark pre-dawn
const SUN_TO = 6.8; // soft dawn, sun just up
const SUN_MS = 6500;

function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// "It all started here" — the once-per-user intro when the couple is complete.
// Deep ocean → title → the beach draws in at dawn as the sun rises → the date →
// "And we're still writing the story." → (partner's note) → "Enter our world".
export function Beginning({
  relationshipStart,
  note,
  noteFrom,
  onDone,
}: {
  relationshipStart: string;
  note: string | null; // shown only if written by the OTHER partner
  noteFrom: string | null; // their first name
  onDone: () => void;
}) {
  const layout = useBeachLayout();
  const reduceMotion = useReducedMotion();
  const hasNote = !!note;
  const buttonAt = hasNote ? BEATS.note + 2000 : BEATS.line + 2200;

  const [elapsedBeat, setElapsedBeat] = useState(0); // which beats have happened (ms mark)
  const [hour, setHour] = useState(SUN_FROM);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sunTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sceneOpacity = useSharedValue(0);

  const showBeach = useCallback(
    (instant: boolean) => {
      sceneOpacity.value = instant ? 1 : withTiming(1, { duration: 1600 });
      if (sunTimer.current) clearInterval(sunTimer.current);
      if (instant || reduceMotion) {
        setHour(SUN_TO);
        return;
      }
      const start = Date.now();
      sunTimer.current = setInterval(() => {
        const t = Math.min(1, (Date.now() - start) / SUN_MS);
        setHour(SUN_FROM + (SUN_TO - SUN_FROM) * (1 - Math.pow(1 - t, 2)));
        if (t >= 1 && sunTimer.current) clearInterval(sunTimer.current);
      }, 80);
    },
    [reduceMotion, sceneOpacity],
  );

  useEffect(() => {
    const marks = [BEATS.title, BEATS.beach, BEATS.date, BEATS.line, ...(hasNote ? [BEATS.note] : []), buttonAt];
    timers.current = marks.map((ms) =>
      setTimeout(() => {
        setElapsedBeat(ms);
        tapHaptic();
        if (ms === BEATS.beach) showBeach(false);
      }, ms),
    );
    return () => {
      timers.current.forEach(clearTimeout);
      if (sunTimer.current) clearInterval(sunTimer.current);
    };
  }, [hasNote, buttonAt, showBeach]);

  const skipToEnd = () => {
    if (elapsedBeat >= buttonAt) return;
    timers.current.forEach(clearTimeout);
    showBeach(true);
    setElapsedBeat(buttonAt);
  };

  const at = (ms: number) => elapsedBeat >= ms;
  const sceneStyle = useAnimatedStyle(() => ({ opacity: sceneOpacity.value }));
  const fade = FadeIn.duration(900);
  const start = parseDate(relationshipStart);

  return (
    <Animated.View exiting={FadeOut.duration(800)} style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={skipToEnd} accessibilityLabel="Skip to the end" accessibilityRole="button">
        {/* 1. deep ocean with a faint, silent wave */}
        <FaintWaves width={layout.W} top={layout.H * 0.55} active={!reduceMotion && !at(BEATS.beach)} />

        {/* 3. the beach draws in at dawn (sun rising) */}
        <Animated.View style={[StyleSheet.absoluteFill, sceneStyle]} pointerEvents="none">
          <Sky layout={layout} hour={hour} active={!reduceMotion} />
          <Sea layout={layout} active={!reduceMotion} dim={0} />
          <Sand layout={layout} dim={0} />
          <Palm x={layout.palmLeft.x} baseY={layout.palmLeft.y} height={layout.palmHeight} active={!reduceMotion} />
        </Animated.View>

        <View style={[styles.text, { top: layout.insets.top + 72 }]} pointerEvents="none">
          {at(BEATS.title) && (
            <Animated.View entering={fade}>
              <Title variant="titleItalic" color={colors.onDark} center style={styles.title}>
                It all started here.
              </Title>
            </Animated.View>
          )}
          {at(BEATS.date) && (
            <Animated.View entering={fade}>
              <Handwritten color={colors.sand} center style={styles.date}>
                {formatLongDate(start)}
              </Handwritten>
            </Animated.View>
          )}
          {at(BEATS.line) && (
            <Animated.View entering={fade}>
              <Body variant="bodyLarge" color={colors.onDark} center style={styles.line}>
                And we're still writing the story.
              </Body>
            </Animated.View>
          )}
        </View>

        {/* 5. their note on a paper slip */}
        {hasNote && at(BEATS.note) && (
          <Animated.View entering={fade} style={[styles.slipWrap, { top: layout.shoreY + 10 }]} pointerEvents="none">
            <View style={styles.slip}>
              <WashiTape color="coral" rotate={-5} style={styles.slipTape} />
              <Handwritten>{note}</Handwritten>
              {noteFrom ? (
                <Handwritten variant="handSmall" color={colors.inkSoft} style={styles.signature}>
                  — {noteFrom}
                </Handwritten>
              ) : null}
            </View>
          </Animated.View>
        )}
      </Pressable>

      {/* 6. enter */}
      {at(buttonAt) && (
        <Animated.View entering={fade} style={[styles.enter, { bottom: layout.insets.bottom + space.xxl }]}>
          <Button title="Enter our world" icon="heart" onPress={onDone} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

function FaintWaves({ width, top, active }: { width: number; top: number; active: boolean }) {
  const p = useLoop(6000, active);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -p.value * 80 }] }));
  const w = width + 80;
  const line = (y: number) => {
    let d = `M0 ${y}`;
    for (let x = 0; x < w; x += 80) d += ` Q${x + 20} ${y - 6} ${x + 40} ${y} T${x + 80} ${y}`;
    return d;
  };
  return (
    <Animated.View style={[styles.waves, { top }, style]} pointerEvents="none">
      <Svg width={w} height={60}>
        <Path d={line(12)} stroke={scene.seaLight} strokeWidth={2} fill="none" opacity={0.25} />
        <Path d={line(34)} stroke={scene.seaLight} strokeWidth={2} fill="none" opacity={0.15} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: colors.deepOcean, zIndex: 50 },
  waves: { position: "absolute", left: 0 },
  text: { position: "absolute", left: space.xl, right: space.xl, alignItems: "center", gap: space.sm },
  title: { fontSize: 34, lineHeight: 40 },
  date: { marginTop: space.md },
  line: { marginTop: space.xs },
  slipWrap: { position: "absolute", left: space.xl, right: space.xl, alignItems: "center" },
  slip: {
    backgroundColor: colors.warmWhite,
    borderRadius: radius.photo,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    maxWidth: 320,
    transform: [{ rotate: "-2deg" }],
    ...shadows.paper,
  },
  slipTape: { position: "absolute", top: -10, alignSelf: "center" },
  signature: { marginTop: space.xs, textAlign: "right" },
  enter: { position: "absolute", left: space.xl, right: space.xl },
});
