import { Body, PressableScale, Sheet, Title } from "@/components/ui";
import { formatSeconds, type ResolvedMedia } from "@/lib/memories";
import { colors, radius, space, type as typeScale } from "@/theme";
import { Image } from "expo-image";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

// A neat grid of everything in the memory (opened from the "+N more" stack).
// Tap = open in the viewer; long-press = remove from memory.
export function MediaGrid({
  visible,
  items,
  onClose,
  onOpen,
  onLongPress,
}: {
  visible: boolean;
  items: ResolvedMedia[];
  onClose: () => void;
  onOpen: (index: number) => void;
  onLongPress: (index: number) => void;
}) {
  const { width, height } = useWindowDimensions();
  const cols = 3;
  const gap = space.sm;
  const size = Math.floor((width - space.xl * 2 - gap * (cols - 1)) / cols);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Title variant="heading">Everything in this memory</Title>
      <Body variant="small" color={colors.inkSoft} style={styles.hint}>
        Long-press a photo to take it out.
      </Body>
      <ScrollView style={{ maxHeight: height * 0.6 }} contentContainerStyle={[styles.grid, { gap }]}>
        {items.map((m, i) => (
          <PressableScale
            key={m.id}
            onPress={() => onOpen(i)}
            onLongPress={() => onLongPress(i)}
            delayLongPress={450}
            accessibilityRole="button"
            accessibilityLabel={`${m.type === "video" ? "Video" : "Photo"} ${i + 1}. Long-press to remove`}
          >
            <View style={[styles.cell, { width: size, height: size }]}>
              {m.thumbUrl ? (
                <Image
                  source={{ uri: m.thumbUrl, cacheKey: m.thumbCacheKey ?? undefined }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  recyclingKey={m.id}
                />
              ) : null}
              {m.type === "video" && (
                <View style={styles.badge}>
                  <Text style={[typeScale.small, styles.badgeText]}>
                    ▶{m.durationSeconds != null ? ` ${formatSeconds(m.durationSeconds)}` : ""}
                  </Text>
                </View>
              )}
            </View>
          </PressableScale>
        ))}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: { marginTop: space.xs, marginBottom: space.md },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingBottom: space.md },
  cell: { borderRadius: radius.photo, overflow: "hidden", backgroundColor: colors.paperDeep },
  badge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(7,26,43,0.6)",
    borderRadius: radius.badge,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: { color: colors.onDark, fontSize: 11, lineHeight: 15 },
});
