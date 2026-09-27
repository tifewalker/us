import { Handwritten, successHaptic, Title } from "@/components/ui";
import { colors, space } from "@/theme";
import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";
import { chapterInfo, type ChapterNumber } from "./chapters";

// Once-only moment when a new chapter is seen: the scene dims and the chapter
// title appears. The new items pop in separately (see BeachScene). Tap or wait
// to dismiss. Reanimated's layout animations skip themselves under Reduce Motion.
export function ChapterUnlock({ chapter, onDone }: { chapter: ChapterNumber; onDone: () => void }) {
  const info = chapterInfo(chapter);

  useEffect(() => {
    successHaptic();
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(500)} style={styles.overlay}>
      <Pressable style={styles.fill} onPress={onDone} accessibilityRole="button" accessibilityLabel={`Chapter ${chapter}, ${info.name}. Tap to continue`}>
        <Animated.View entering={ZoomIn.springify().damping(14).delay(150)} style={styles.card}>
          <Handwritten color={colors.sand} center>
            Chapter {chapter}
          </Handwritten>
          <Title variant="titleItalic" color={colors.onDark} center>
            {info.name}
          </Title>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(7,26,43,0.45)", zIndex: 20 },
  fill: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
  card: { alignItems: "center", gap: space.xs },
});
