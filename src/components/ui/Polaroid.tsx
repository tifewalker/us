import { colors, POLAROID_MAX_TILT, radius, shadows, space, type as typeScale, type TapeColor } from "@/theme";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Icon3D } from "./Icon3D";
import { PressableScale } from "./PressableScale";
import { seededTilt } from "./seeded";
import { WashiTape } from "./WashiTape";

const SIDE = 8;
const BOTTOM = 28;

// A polaroid: white border (thicker at the bottom), Caveat caption, and a
// random-but-stable tilt seeded by `seed` (use the memory/media id).
export function Polaroid({
  seed,
  uri,
  cacheKey,
  width,
  photoHeight,
  caption,
  videoDuration,
  isVideo = false,
  tape,
  onPress,
  accessibilityLabel,
  onLongPress,
  style,
  children,
}: {
  seed: string;
  uri?: string | null;
  // Stable expo-image cache key — pass the storage path so the image stays
  // cached even when its signed URL changes.
  cacheKey?: string | null;
  width: number;
  photoHeight?: number; // defaults to square
  caption?: string;
  isVideo?: boolean;
  videoDuration?: string | null; // pre-formatted, e.g. "0:42"
  tape?: TapeColor;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode; // rendered in place of the photo (e.g. an icon placeholder)
}) {
  const tilt = seededTilt(seed, POLAROID_MAX_TILT);
  const photoSize = width - SIDE * 2;
  const photoH = photoHeight ?? photoSize;
  const bottom = caption ? BOTTOM + 8 : BOTTOM;

  const body = (
    <View
      style={[
        styles.frame,
        { width, paddingBottom: bottom, transform: [{ rotate: `${tilt}deg` }] },
        style,
      ]}
    >
      <View style={[styles.photo, { width: photoSize, height: photoH }]}>
        {uri ? (
          <Image
            source={cacheKey ? { uri, cacheKey } : { uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            // Bias toward the upper-middle, where faces usually are.
            contentPosition={{ top: "30%", left: "50%" }}
            transition={200}
            recyclingKey={cacheKey ?? uri}
          />
        ) : (
          children ?? (
            <View style={styles.placeholder}>
              <Icon3D name={isVideo ? "film" : "camera"} size={photoSize * 0.4} />
            </View>
          )
        )}
        {isVideo && (
          <>
            <View style={styles.playOverlay} pointerEvents="none">
              <View style={styles.playDisc}>
                <Text style={styles.playIcon}>▶</Text>
              </View>
            </View>
            {videoDuration && (
              <View style={styles.duration}>
                <Text style={[typeScale.small, styles.durationText]}>{videoDuration}</Text>
              </View>
            )}
          </>
        )}
      </View>
      {caption ? (
        <Text numberOfLines={1} style={[typeScale.handSmall, styles.caption]}>
          {caption}
        </Text>
      ) : null}
      {tape && (
        <WashiTape
          color={tape}
          width={Math.min(64, width * 0.45)}
          rotate={seededTilt(seed, 8, 1)}
          style={styles.tape}
        />
      )}
    </View>
  );

  if (!onPress && !onLongPress) return body;
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? caption}
    >
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.warmWhite,
    padding: SIDE,
    borderRadius: radius.photo,
    ...shadows.paper,
  },
  photo: {
    backgroundColor: colors.paperDeep,
    overflow: "hidden",
    borderRadius: 1,
  },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  caption: {
    color: colors.ink,
    position: "absolute",
    left: SIDE,
    right: SIDE,
    bottom: 6,
    textAlign: "center",
  },
  playOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  playDisc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(7,26,43,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: { color: colors.onDark, fontSize: 16, marginLeft: 3 },
  duration: {
    position: "absolute",
    right: space.xs,
    bottom: space.xs,
    backgroundColor: "rgba(7,26,43,0.6)",
    borderRadius: radius.badge,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  durationText: { color: colors.onDark, fontSize: 11, lineHeight: 15 },
  tape: { position: "absolute", top: -10, alignSelf: "center" },
});
