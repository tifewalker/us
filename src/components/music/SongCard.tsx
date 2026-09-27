import { Body, Button, PressableScale, Title } from "@/components/ui";
import { openFullSong, togglePreview, usePreviewState, type Song } from "@/lib/music";
import { colors, radius, shadows, space, type as typeScale } from "@/theme";
import { Alert, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { VinylRecord } from "./VinylRecord";

// A song as an object: a vinyl record (cover art as the label, spinning while
// its preview plays) + title, artist, ▶ preview and "Open full song".
// `compact` stacks it vertically for side-by-side use (activity reveal).
export function SongCard({
  song,
  compact = false,
  onRemove,
  style,
}: {
  song: Song;
  compact?: boolean;
  onRemove?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const preview = usePreviewState();
  const playing = preview.songId === song.itunesId && preview.playing;
  const recordSize = compact ? 96 : 112;

  async function open() {
    try {
      await openFullSong(song);
    } catch (e: any) {
      Alert.alert("Couldn't open the song", e?.message ?? String(e));
    }
  }

  return (
    <View style={[styles.card, compact && styles.compact, style]}>
      <View style={[styles.recordWrap, compact && styles.recordCompact]}>
        <VinylRecord size={recordSize} artworkUrl={song.artworkUrl} spinning={playing} />
      </View>
      <View style={[styles.info, compact && styles.infoCompact]}>
        <Title variant="heading" numberOfLines={2} style={compact && styles.center}>
          {song.title}
        </Title>
        <Body variant="small" color={colors.inkSoft} numberOfLines={1} style={compact && styles.center}>
          {song.artist}
        </Body>
        <View style={[styles.actions, compact && styles.actionsCompact]}>
          {song.previewUrl ? (
            <PressableScale
              onPress={() => togglePreview(song)}
              accessibilityRole="button"
              accessibilityLabel={playing ? `Pause preview of ${song.title}` : `Play preview of ${song.title}`}
              style={styles.play}
            >
              <Text style={styles.playIcon}>{playing ? "❚❚" : "▶"}</Text>
            </PressableScale>
          ) : null}
          <Button title="Open full song" variant="soft" onPress={open} style={styles.open} />
        </View>
        {onRemove ? <Button title="Remove song" variant="text" onPress={onRemove} style={styles.remove} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    backgroundColor: colors.warmWhite,
    borderRadius: radius.paper,
    padding: space.lg,
    ...shadows.paper,
  },
  compact: { flexDirection: "column", flex: 1, padding: space.md, gap: space.sm },
  recordWrap: { marginLeft: -space.xl }, // the record peeks out of its sleeve
  recordCompact: { marginLeft: 0 },
  info: { flex: 1 },
  infoCompact: { alignItems: "center", flex: 0, width: "100%" },
  center: { textAlign: "center" },
  actions: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md },
  actionsCompact: { flexDirection: "column", alignSelf: "stretch" },
  play: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ocean,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.lifted,
  },
  playIcon: { ...typeScale.button, color: colors.onDark, fontSize: 14 },
  open: { minHeight: 44, paddingHorizontal: space.lg, flexShrink: 1 },
  remove: { alignSelf: "flex-start", marginTop: space.xs, paddingHorizontal: 0 },
});
