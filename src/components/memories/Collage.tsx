import { Body, Polaroid, seededTilt } from "@/components/ui";
import { formatSeconds, type ResolvedMedia } from "@/lib/memories";
import { colors, radius, shadows, space } from "@/theme";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { PressableScale } from "@/components/ui";

type Slot = { x: number; y: number; w: number }; // fractions of the container width

// Collage layouts by media count (DESIGN.md → Memories). x/y/w are fractions
// of the container width, so they scale from an iPhone SE to a Pro Max.
const LAYOUTS: Record<number, Slot[]> = {
  1: [{ x: 0.07, y: 0.02, w: 0.86 }],
  2: [
    { x: 0.0, y: 0.0, w: 0.6 },
    { x: 0.38, y: 0.3, w: 0.6 },
  ],
  3: [
    { x: 0.16, y: 0.1, w: 0.68 }, // large centre
    { x: 0.0, y: 0.0, w: 0.36 }, // tucked top-left
    { x: 0.64, y: 0.6, w: 0.36 }, // tucked bottom-right
  ],
  4: [
    { x: 0.0, y: 0.0, w: 0.5 },
    { x: 0.48, y: 0.06, w: 0.5 },
    { x: 0.04, y: 0.52, w: 0.5 },
    { x: 0.5, y: 0.58, w: 0.48 },
  ],
  5: [
    { x: 0.0, y: 0.0, w: 0.46 },
    { x: 0.54, y: 0.04, w: 0.46 },
    { x: 0.02, y: 0.62, w: 0.46 },
    { x: 0.52, y: 0.66, w: 0.46 },
    { x: 0.24, y: 0.3, w: 0.52 }, // on top, centre
  ],
};
const BOTTOM_BORDER = 28;

// Draw order: for 3 and 5 the "hero" slot is drawn last (on top).
const DRAW_ORDER: Record<number, number[]> = {
  1: [0],
  2: [0, 1],
  3: [1, 2, 0],
  4: [0, 1, 2, 3],
  5: [0, 1, 2, 3, 4],
};

export function Collage({
  items,
  width,
  focused,
  onOpen,
  onLongPress,
  onMore,
}: {
  items: ResolvedMedia[];
  width: number;
  focused: boolean; // screen focus — the autoplaying video pauses when false
  onOpen: (index: number) => void;
  onLongPress: (index: number) => void;
  onMore: () => void;
}) {
  const shown = items.slice(0, 5);
  const n = shown.length;
  if (n === 0) return null;
  const slots = LAYOUTS[n];
  const height = Math.max(...slots.map((s) => (s.y + s.w) * width + BOTTOM_BORDER)) + space.md;
  // Only the FIRST video in the collage autoplays (muted, looped). Max one player.
  const autoplayIndex = shown.findIndex((m) => m.type === "video");
  const extra = items.length - 5;

  return (
    <View>
      <View style={{ width, height }}>
        {DRAW_ORDER[n].map((i) => {
          const m = shown[i];
          const s = slots[i];
          const w = s.w * width;
          const autoplay = i === autoplayIndex;
          return (
            <View key={m.id} style={[styles.abs, { left: s.x * width, top: s.y * width }]}>
              <Polaroid
                seed={m.id}
                uri={autoplay ? null : m.thumbUrl}
                cacheKey={m.thumbCacheKey}
                width={w}
                isVideo={m.type === "video" && !autoplay}
                videoDuration={m.durationSeconds != null ? formatSeconds(m.durationSeconds) : null}
                onPress={() => onOpen(i)}
                onLongPress={() => onLongPress(i)}
                accessibilityLabel={`${m.type === "video" ? "Video" : "Photo"} ${i + 1} of ${items.length}. Long-press for options`}
              >
                {autoplay ? <AutoplayVideo url={m.url} poster={m.thumbUrl} posterKey={m.thumbCacheKey} playing={focused} /> : undefined}
              </Polaroid>
            </View>
          );
        })}
      </View>

      {extra > 0 && (
        <PressableScale onPress={onMore} accessibilityRole="button" accessibilityLabel={`See all ${items.length}`} style={styles.moreWrap}>
          <View style={styles.moreStack}>
            {[2, 1, 0].map((k) => (
              <View
                key={k}
                style={[
                  styles.moreCard,
                  { transform: [{ rotate: `${seededTilt(`more-${k}`, 6)}deg` }, { translateX: k * 4 }] },
                ]}
              >
                {k === 0 && items[5]?.thumbUrl ? (
                  <Image
                    source={{ uri: items[5].thumbUrl!, cacheKey: items[5].thumbCacheKey ?? undefined }}
                    style={styles.moreImage}
                    contentFit="cover"
                  />
                ) : null}
              </View>
            ))}
          </View>
          <Body variant="bodyStrong" color={colors.inkOcean}>
            +{extra} more
          </Body>
        </PressableScale>
      )}
    </View>
  );
}

// Muted, looping, no controls. Pauses when the screen loses focus.
function AutoplayVideo({
  url,
  poster,
  posterKey,
  playing,
}: {
  url: string;
  poster: string | null;
  posterKey: string | null;
  playing: boolean;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.muted = true;
    p.loop = true;
  });
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [playing, player]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {poster ? (
        <Image source={{ uri: poster, cacheKey: posterKey ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
      <VideoView playsInline player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  moreWrap: { flexDirection: "row", alignItems: "center", gap: space.lg, alignSelf: "center", marginTop: space.md },
  moreStack: { width: 76, height: 76 },
  moreCard: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.warmWhite,
    borderRadius: radius.photo,
    padding: 5,
    paddingBottom: 14,
    ...shadows.lifted,
  },
  moreImage: { flex: 1, borderRadius: 1 },
});
