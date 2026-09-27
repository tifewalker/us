import { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

// The story engine shared with "Play this memory" (same rules as reel.tsx —
// see CLAUDE.md → Reel timing rules): a plain JS clock decides WHEN to
// advance; the shared `progress` value only draws the bars, is always SET and
// never read back, and runs with ReduceMotion.Never (it's a clock).

// duration 0 = an interactive page: no timer, it waits for the viewer.
export function useStoryClock({ index, duration, paused, onEnd }: { index: number; duration: number; paused: boolean; onEnd: () => void }) {
  const progress = useSharedValue(0);
  const clock = useRef<{ elapsed: number; startedAt: number | null }>({ elapsed: 0, startedAt: null });
  const endRef = useRef(onEnd);
  endRef.current = onEnd;

  useEffect(() => {
    clock.current = { elapsed: 0, startedAt: null };
    progress.value = 0;
  }, [index, progress]);

  useEffect(() => {
    if (duration === 0 || paused) return;
    const c = clock.current;
    const remaining = Math.max(0, duration - c.elapsed);
    c.startedAt = Date.now();
    progress.value = withSequence(
      withTiming(Math.min(1, c.elapsed / duration), { duration: 0, reduceMotion: ReduceMotion.Never }),
      withTiming(1, { duration: remaining, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
    );
    const t = setTimeout(() => endRef.current(), remaining);
    return () => {
      clearTimeout(t);
      if (c.startedAt != null) {
        c.elapsed += Date.now() - c.startedAt;
        c.startedAt = null;
      }
      cancelAnimation(progress);
      progress.value = Math.min(1, c.elapsed / duration);
    };
  }, [index, duration, paused, progress]);

  return progress;
}

export function ProgressBars({
  count,
  current,
  progress,
  top,
  tone = "light",
}: {
  count: number;
  current: number;
  progress: SharedValue<number>;
  top: number;
  tone?: "light" | "ink";
}) {
  return (
    <View style={[styles.bars, { top }]} pointerEvents="none">
      {Array.from({ length: count }, (_, i) => (
        <Bar key={i} state={i < current ? "done" : i === current ? "current" : "todo"} progress={progress} tone={tone} />
      ))}
    </View>
  );
}

function Bar({ state, progress, tone }: { state: "done" | "current" | "todo"; progress: SharedValue<number>; tone: "light" | "ink" }) {
  const fill = useAnimatedStyle(() => ({ width: `${(state === "done" ? 1 : state === "current" ? progress.value : 0) * 100}%` }));
  return (
    <View style={[styles.bar, tone === "ink" && styles.barInk]}>
      <Animated.View style={[styles.barFill, tone === "ink" && styles.barFillInk, fill]} />
    </View>
  );
}

// Tap left 35% = previous, right 65% = next, hold = pause.
export function TapZones({ onPrev, onNext, onHold }: { onPrev: () => void; onNext: () => void; onHold: (held: boolean) => void }) {
  const holding = useRef(false);
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.zones}>
        {[-1, 1].map((dir) => (
          <Pressable
            key={dir}
            style={dir === -1 ? styles.zoneLeft : styles.zoneRight}
            onPress={() => {
              if (!holding.current) (dir === -1 ? onPrev : onNext)();
            }}
            onLongPress={() => {
              holding.current = true;
              onHold(true);
            }}
            delayLongPress={220}
            onPressOut={() => {
              if (holding.current) {
                onHold(false);
                setTimeout(() => (holding.current = false), 0);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={dir === -1 ? "Previous" : "Next"}
          />
        ))}
      </View>
    </View>
  );
}

// Swipe down to close (wrap the screen in a GestureDetector with `gesture`).
export function useSwipeDown(onClose: () => void) {
  const dragY = useSharedValue(0);
  const close = useCallback(() => onClose(), [onClose]);
  const gesture = Gesture.Pan()
    .activeOffsetY(18)
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) scheduleOnRN(close);
      else dragY.value = withTiming(0, { duration: 180 });
    });
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }], opacity: 1 - Math.min(dragY.value / 600, 0.4) }));
  return { gesture, style };
}

const styles = StyleSheet.create({
  bars: { position: "absolute", left: 12, right: 12, flexDirection: "row", gap: 3 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,248,239,0.3)", overflow: "hidden" },
  barInk: { backgroundColor: "rgba(43,37,32,0.15)" },
  barFill: { height: "100%", backgroundColor: "#FFF8EF" },
  barFillInk: { backgroundColor: "#6E5F52" },
  zones: { flex: 1, flexDirection: "row" },
  zoneLeft: { flex: 35 },
  zoneRight: { flex: 65 },
});
