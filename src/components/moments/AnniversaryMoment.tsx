import { Body, Button, Handwritten, tapHaptic, Title } from "@/components/ui";
import { anniversarySky, colors, space } from "@/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

// Beats (ms): dark → sunset fades in → the date → "Another year of us." →
// years · days → buttons. Tap anywhere to skip to the end. Haptic per beat.
const BEATS = { sky: 300, date: 1300, line: 2600, count: 4000, end: 5200 };

// Once per person per anniversary (AsyncStorage/localStorage), after the
// Beginning and birthday moments.
export function AnniversaryMoment({
  dateLabel,
  years,
  days,
  onWatch,
  onDone,
}: {
  dateLabel: string; // "29 March"
  years: number;
  days: number;
  onWatch: () => void;
  onDone: () => void;
}) {
  const [at, setAt] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timers.current = Object.values(BEATS).map((ms) =>
      setTimeout(() => {
        setAt(ms);
        if (ms > BEATS.sky) tapHaptic();
      }, ms),
    );
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const skip = () => {
    timers.current.forEach(clearTimeout);
    setAt(BEATS.end);
  };
  const fade = FadeIn.duration(900);

  return (
    <Animated.View exiting={FadeOut.duration(600)} style={[StyleSheet.absoluteFill, styles.dark]}>
      {at >= BEATS.sky && (
        <Animated.View entering={FadeIn.duration(1400)} style={StyleSheet.absoluteFill}>
          <LinearGradient colors={[anniversarySky[0], anniversarySky[1], anniversarySky[2]]} style={StyleSheet.absoluteFill} />
          <View style={styles.sun} />
        </Animated.View>
      )}
      <Pressable style={styles.center} onPress={skip} accessibilityRole="button" accessibilityLabel="Skip">
        {at >= BEATS.date && (
          <Animated.View entering={fade}>
            <Handwritten color={colors.warmWhite} center style={styles.date}>
              {dateLabel}
            </Handwritten>
          </Animated.View>
        )}
        {at >= BEATS.line && (
          <Animated.View entering={fade}>
            <Title variant="titleItalic" color={colors.onDark} center style={styles.line}>
              Another year of us.
            </Title>
          </Animated.View>
        )}
        {at >= BEATS.count && (
          <Animated.View entering={fade}>
            <Body variant="bodyLarge" color={colors.onDarkSoft} center>
              {years} {years === 1 ? "year" : "years"} · {days.toLocaleString()} days together
            </Body>
          </Animated.View>
        )}
        {at >= BEATS.end && (
          <Animated.View entering={fade} style={styles.end}>
            <Button title="Look back at our year" icon="film" onPress={onWatch} />
            <Button title="Later" variant="text" onPress={onDone} style={styles.later} />
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dark: { backgroundColor: colors.deepOcean },
  sun: { position: "absolute", alignSelf: "center", bottom: "18%", width: 150, height: 150, borderRadius: 75, backgroundColor: "#FFC47A", opacity: 0.55 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.md },
  date: { fontSize: 34, lineHeight: 40 },
  line: { fontSize: 36, lineHeight: 42 },
  end: { marginTop: space.xl, alignItems: "center", gap: space.xs },
  later: { opacity: 0.9 },
});
