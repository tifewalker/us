import { useEffect } from "react";
import {
    cancelAnimation,
    Easing,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
    type SharedValue,
} from "react-native-reanimated";

// A 0→1 progress value that loops forever on the UI thread while `active`,
// and stops (holding its value) when not. `reverse` ping-pongs 0→1→0 (sway);
// otherwise it restarts at 0 (drift, waves).
export function useLoop(
  duration: number,
  active: boolean,
  { reverse = false, delay = 0, initial = 0 }: { reverse?: boolean; delay?: number; initial?: number } = {},
): SharedValue<number> {
  const progress = useSharedValue(initial);

  useEffect(() => {
    if (!active) {
      cancelAnimation(progress);
      return;
    }
    const easing = reverse ? Easing.inOut(Easing.sin) : Easing.linear;
    if (reverse) {
      progress.value = withDelay(
        delay,
        withRepeat(withTiming(1, { duration, easing }), -1, true),
      );
    } else {
      // Finish the current lap from wherever we paused, then loop cleanly.
      const remaining = Math.max(1, duration * (1 - progress.value));
      progress.value = withDelay(
        delay,
        withTiming(1, { duration: remaining, easing }, (finished) => {
          if (!finished) return;
          progress.value = 0;
          progress.value = withRepeat(withTiming(1, { duration, easing }), -1, false);
        }),
      );
    }
    return () => cancelAnimation(progress);
  }, [active, duration, reverse, delay, progress]);

  return progress;
}
