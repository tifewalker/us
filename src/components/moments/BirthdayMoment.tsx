import { useLoop } from "@/components/beach/useLoop";
import { Body, Button, Handwritten, Icon3D, tapHaptic, Title } from "@/components/ui";
import { colors, skies, space } from "@/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useReducedMotion } from "react-native-reanimated";
import { SparkleBurst } from "./effects";

const BEATS = { title: 600, age: 2600, end: 4600 };

// The birthday person's first open on their birthday (once per year):
// golden sky → "Today is your day." → "{age} years of you" → if a birthday
// gift is unlocked, the wrapped gift glows ("Open your gift"). Tap to skip.
export function BirthdayMoment({
  name,
  age,
  hasGift,
  onOpenGift,
  onDone,
}: {
  name: string;
  age: number;
  hasGift: boolean;
  onOpenGift: () => void;
  onDone: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [at, setAt] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const glow = useLoop(1600, !reduceMotion && at >= BEATS.end && hasGift, { reverse: true });
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.3 + glow.value * 0.5, transform: [{ scale: 1 + glow.value * 0.18 }] }));

  useEffect(() => {
    timers.current = [BEATS.title, BEATS.age, BEATS.end].map((ms) =>
      setTimeout(() => {
        setAt(ms);
        tapHaptic();
      }, ms),
    );
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const skip = () => {
    timers.current.forEach(clearTimeout);
    setAt(BEATS.end);
  };
  const fade = FadeIn.duration(800);
  const sky = skies.goldenHour;

  return (
    <Animated.View exiting={FadeOut.duration(600)} style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[sky[0], sky[1], sky[2]]} style={StyleSheet.absoluteFill} />
      <Pressable style={styles.center} onPress={skip} accessibilityRole="button" accessibilityLabel="Skip">
        {at >= BEATS.title && (
          <Animated.View entering={fade}>
            <Title variant="titleItalic" color={colors.onDark} center style={styles.title}>
              Today is your day.
            </Title>
          </Animated.View>
        )}
        {at >= BEATS.age && (
          <Animated.View entering={fade}>
            <Handwritten color={colors.warmWhite} center style={styles.age}>
              {age > 0 ? `${age} years of you, ${name}` : `Happy birthday, ${name}`}
            </Handwritten>
          </Animated.View>
        )}
        {at >= BEATS.end && (
          <Animated.View entering={fade} style={styles.end}>
            {hasGift ? (
              <>
                <View style={styles.giftWrap}>
                  <Animated.View style={[styles.glow, glowStyle]} />
                  <Icon3D name="gift" size={96} />
                </View>
                <Body color={colors.onDark} center>
                  Someone left you something.
                </Body>
                <Button title="Open your gift" icon="sparkles" onPress={onOpenGift} style={styles.button} />
                <Button title="Later" variant="text" onPress={onDone} />
              </>
            ) : (
              <>
                <Icon3D name="cake" size={96} />
                <Button title="Enter our world" icon="heart" onPress={onDone} style={styles.button} />
              </>
            )}
          </Animated.View>
        )}
      </Pressable>
      {at >= BEATS.end && <SparkleBurst x={width / 2} y={height / 2 + 20} seed="birthday" />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.md },
  title: { fontSize: 36, lineHeight: 42 },
  age: { fontSize: 30, lineHeight: 34 },
  end: { alignItems: "center", marginTop: space.xl, gap: space.sm },
  giftWrap: { alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: 130, height: 130, borderRadius: 65, backgroundColor: colors.sand },
  button: { marginTop: space.md, minWidth: 220 },
});
