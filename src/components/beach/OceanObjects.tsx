import { Handwritten, Icon3D, Polaroid, PressableScale, tapHaptic } from "@/components/ui";
import { seededUnit } from "@/components/ui/seeded";
import { colors, radius, shadows, space, type as typeScale } from "@/theme";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle } from "react-native-reanimated";
import { useLoop } from "./useLoop";

// "Write a bottle": the envelope-with-arrow sticker on the sand.
export function WriteBottleSticker({ left, top, onPress }: { left: number; top: number; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Write a bottle" style={[styles.abs, styles.sticker, { left, top }]}>
      <Icon3D name="envelope" size={40} style={{ transform: [{ rotate: "-8deg" }] }} />
      <Text style={[typeScale.small, styles.stickerLabel]} numberOfLines={2}>
        Write a bottle
      </Text>
    </PressableScale>
  );
}

// Bottles still drifting my way, far out at sea (count only — no content).
export function SeaBottles({
  count,
  y,
  xFrom,
  xTo,
  active,
}: {
  count: number;
  y: number;
  xFrom: number;
  xTo: number;
  active: boolean;
}) {
  const [toast, setToast] = useState(false);
  const shown = Math.min(count, 5);
  if (shown === 0) return null;
  return (
    <>
      {Array.from({ length: shown }, (_, i) => (
        <SeaBottle
          key={i}
          x={xFrom + ((xTo - xFrom) * (i + 0.5)) / shown + (seededUnit(`sea-${i}`, 1) - 0.5) * 20}
          y={y + seededUnit(`sea-${i}`, 2) * 22}
          index={i}
          active={active}
          onPress={() => {
            tapHaptic();
            setToast(true);
            setTimeout(() => setToast(false), 2200);
          }}
        />
      ))}
      {toast && (
        <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(400)} style={[styles.abs, styles.toast, { top: y - 44, left: xFrom - 20 }]} pointerEvents="none">
          <Text style={[typeScale.small, styles.toastText]}>Something is drifting your way</Text>
        </Animated.View>
      )}
    </>
  );
}

function SeaBottle({ x, y, index, active, onPress }: { x: number; y: number; index: number; active: boolean; onPress: () => void }) {
  const bob = useLoop(2200 + index * 300, active, { reverse: true, delay: index * 250 });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: (bob.value - 0.5) * 4 }, { rotate: `${-30 + (bob.value - 0.5) * 16}deg` }],
  }));
  return (
    <PressableScale onPress={onPress} haptic={false} hitSlop={12} accessibilityRole="button" accessibilityLabel="A bottle drifting your way" style={[styles.abs, { left: x - 9, top: y }]}>
      <Animated.View style={style}>
        <Icon3D name="bottle" size={18} />
      </Animated.View>
    </PressableScale>
  );
}

// Unlocked, unopened bottles washed up at the waterline, bobbing.
export function WashedBottle({ left, top, count, active, onPress }: { left: number; top: number; count: number; active: boolean; onPress: () => void }) {
  const bob = useLoop(2600, active, { reverse: true });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: (bob.value - 0.5) * 6 }, { rotate: `${-40 + (bob.value - 0.5) * 10}deg` }],
  }));
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Something washed ashore for you" style={[styles.abs, { left, top }]}>
      <Animated.View style={style}>
        <Icon3D name="bottle" size={46} />
      </Animated.View>
      {count > 1 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
    </PressableScale>
  );
}

// The open-when jar (only when I have open-when notes).
export function JarSticker({ left, top, unopened, onPress }: { left: number; top: number; unopened: number; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open-when jar${unopened ? `, ${unopened} unopened` : ""}`} style={[styles.abs, { left, top }]}>
      <View style={styles.jar}>
        <Icon3D name="loveLetter" size={30} />
      </View>
      {unopened > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unopened}</Text>
        </View>
      )}
    </PressableScale>
  );
}

// A note pinned over the polaroid for 3 days after my partner adds a memory.
export function NewMemoryTag({
  x,
  top,
  width,
  partnerName,
  title,
  onPress,
}: {
  x: number;
  top: number;
  width: number;
  partnerName: string;
  title: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${partnerName} added ${title}. What do you remember?`}
      style={[styles.abs, styles.tag, { left: x - width / 2, top, width }]}
    >
      <View style={styles.pin} />
      <Handwritten variant="handSmall" center numberOfLines={3} style={styles.tagText}>
        {partnerName} added "{title}" — what do you remember?
      </Handwritten>
    </PressableScale>
  );
}

// "Remember when…": a small polaroid washed in at the tide line.
export function RememberPolaroid({
  left,
  top,
  seed,
  uri,
  cacheKey,
  onPress,
}: {
  left: number;
  top: number;
  seed: string;
  uri: string | null;
  cacheKey: string | null;
  onPress: () => void;
}) {
  return (
    <View style={[styles.abs, { left, top }]}>
      <Polaroid seed={seed} uri={uri} cacheKey={cacheKey} width={64} tape="sky" onPress={onPress} accessibilityLabel="Remember when…" />
      <Handwritten variant="handSmall" style={styles.rememberLabel}>
        Remember when…
      </Handwritten>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  sticker: { alignItems: "center", width: 64 },
  stickerLabel: { color: colors.inkOcean, fontSize: 11, lineHeight: 13, textAlign: "center" },
  toast: { backgroundColor: "rgba(7,26,43,0.7)", borderRadius: radius.badge, paddingHorizontal: space.sm, paddingVertical: space.xs },
  toastText: { color: colors.onDark },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.onDark, fontSize: 11, fontWeight: "700" },
  jar: {
    width: 44,
    height: 52,
    borderRadius: 10,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: "rgba(191,227,240,0.55)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.lifted,
  },
  tag: {
    backgroundColor: colors.warmWhite,
    borderRadius: radius.photo,
    paddingTop: space.sm,
    paddingBottom: space.xs,
    paddingHorizontal: space.sm,
    transform: [{ rotate: "-2deg" }],
    ...shadows.paper,
  },
  pin: { position: "absolute", top: -5, alignSelf: "center", width: 10, height: 10, borderRadius: 5, backgroundColor: colors.sunset },
  tagText: { fontSize: 16, lineHeight: 18 },
  rememberLabel: { color: colors.inkOcean, marginTop: 2, fontSize: 16, lineHeight: 18 },
});
