import { Body, Icon3D, PressableScale, seededTilt } from "@/components/ui";
import { formatSeconds } from "@/lib/memories";
import { colors, radius, shadows, space, type as typeScale } from "@/theme";
import { Image } from "expo-image";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { PickedAsset, UploadProgress } from "./useMediaPicker";

const THUMB = 84;

// The "add" object (a stack of blank polaroids), the picked thumbnails (tap to
// take one out) and the upload progress bar. Pair with useMediaPicker().
export function MediaTray({
  assets,
  preparing,
  progress,
  disabled,
  onPick,
  onRemove,
}: {
  assets: PickedAsset[];
  preparing: boolean;
  progress: UploadProgress | null;
  disabled?: boolean;
  onPick: () => void;
  onRemove: (uri: string) => void;
}) {
  return (
    <>
      <PressableScale
        onPress={onPick}
        disabled={preparing || disabled}
        accessibilityRole="button"
        accessibilityLabel="Add photos or videos"
        style={styles.addStack}
      >
        <View style={[styles.addCard, styles.addCardBack]} />
        <View style={styles.addCard}>
          {preparing ? <ActivityIndicator color={colors.ocean} /> : <Icon3D name="camera" size={44} />}
          <Text style={[typeScale.button, styles.addText]}>
            {preparing ? "Preparing…" : "Add photos and videos"}
          </Text>
        </View>
      </PressableScale>

      {assets.length > 0 && (
        <>
          <Body variant="small" color={colors.inkSoft} style={styles.hint}>
            Tap a photo to take it out.
          </Body>
          <View style={styles.grid}>
            {assets.map((asset) => (
              <PressableScale
                key={asset.uri}
                onPress={() => onRemove(asset.uri)}
                disabled={!!progress}
                accessibilityLabel={`Remove ${asset.type === "video" ? "video" : "photo"}`}
                style={[styles.thumbFrame, { transform: [{ rotate: `${seededTilt(asset.uri, 3)}deg` }] }]}
              >
                {asset.type === "video" && !asset.thumbnailUri ? (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Icon3D name="film" size={32} />
                  </View>
                ) : (
                  <Image source={{ uri: asset.thumbnailUri ?? asset.uri }} style={styles.thumb} contentFit="cover" />
                )}
                {asset.type === "video" && (
                  <View style={styles.videoBadge}>
                    <Text style={[typeScale.small, styles.videoBadgeText]}>
                      ▶{asset.duration ? ` ${formatSeconds(Math.round(asset.duration / 1000))}` : ""}
                    </Text>
                  </View>
                )}
              </PressableScale>
            ))}
          </View>
        </>
      )}

      {progress && (
        <View style={styles.progress} accessibilityLiveRegion="polite">
          <Body variant="label" color={colors.inkOcean}>
            Uploading {progress.index} of {progress.total} — {Math.round(progress.fraction * 100)}%
          </Body>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(((progress.index - 1 + progress.fraction) / progress.total) * 100)}%` },
              ]}
            />
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  addStack: { marginTop: space.md, height: 128 },
  addCard: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.warmWhite,
    borderRadius: radius.photo,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderWidth: 1.5,
    borderColor: colors.paperEdge,
    borderStyle: "dashed",
    ...shadows.lifted,
  },
  addCardBack: { transform: [{ rotate: "2.5deg" }], backgroundColor: colors.paperDeep, borderStyle: "solid" },
  addText: { color: colors.ocean },
  hint: { marginTop: space.xl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginTop: space.sm },
  thumbFrame: {
    backgroundColor: colors.warmWhite,
    padding: 4,
    paddingBottom: 12,
    borderRadius: radius.photo,
    ...shadows.lifted,
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: 1 },
  thumbPlaceholder: { backgroundColor: colors.paperDeep, alignItems: "center", justifyContent: "center" },
  videoBadge: {
    position: "absolute",
    bottom: 16,
    left: 8,
    backgroundColor: "rgba(7,26,43,0.6)",
    borderRadius: radius.badge,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  videoBadgeText: { color: colors.onDark, fontSize: 11, lineHeight: 15 },
  progress: { marginTop: space.xl, gap: space.sm },
  progressTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.paperDeep, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.ocean, borderRadius: radius.pill },
});
