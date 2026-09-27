import { Body, PressableScale } from "@/components/ui";
import { getMemoryById, resolveMedia, ResolvedMedia } from "@/lib/memories";
import { colors, shadows, type as typeScale } from "@/theme";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    View,
} from "react-native";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Full-screen viewer for one memory's photos and videos, swipeable.
// Opened from the memory detail grid with ?memoryId=…&index=….
export default function MediaViewer() {
  const { memoryId, index } = useLocalSearchParams<{
    memoryId: string;
    index?: string;
  }>();
  const startIndex = Number(index ?? 0) || 0;
  const [items, setItems] = useState<ResolvedMedia[] | null>(null);
  const [active, setActive] = useState(startIndex);

  // warm the neighbours so swiping to the next / previous photo is instant
  useEffect(() => {
    if (!items) return;
    const near = [items[active + 1], items[active - 1], items[active + 2]]
      .filter((m): m is ResolvedMedia => !!m && m.type === "photo")
      .map((m) => m.url);
    if (near.length) Image.prefetch(near).catch(() => {});
  }, [items, active]);

  useEffect(() => {
    if (!memoryId) return;
    (async () => {
      try {
        const memory = await getMemoryById(memoryId);
        // voice notes aren't in the viewer (same indexes as the collage)
        setItems((await resolveMedia(memory.memory_media ?? [])).filter((m) => m.type !== "voice"));
      } catch (err: any) {
        console.log("[MediaViewer] load failed:", err.message);
        setItems([]);
      }
    })();
  }, [memoryId]);

  return (
    <View style={styles.container}>
      {items === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(startIndex, Math.max(items.length - 1, 0))}
          getItemLayout={(_, i) => ({
            length: screenWidth,
            offset: screenWidth * i,
            index: i,
          })}
          onMomentumScrollEnd={(e) =>
            setActive(Math.round(e.nativeEvent.contentOffset.x / screenWidth))
          }
          renderItem={({ item, index: i }) => (
            <View style={styles.slide}>
              {item.type === "video" ? (
                // Only the visible slide gets a player; others show the thumbnail.
                i === active ? (
                  <VideoSlide url={item.url} />
                ) : item.thumbUrl ? (
                  <Image
                    source={{ uri: item.thumbUrl, cacheKey: item.thumbCacheKey ?? undefined }}
                    style={styles.media}
                    contentFit="contain"
                  />
                ) : null
              ) : (
                <Image
                  source={{ uri: item.url, cacheKey: item.cacheKey }}
                  style={styles.media}
                  contentFit="contain"
                  recyclingKey={item.id}
                />
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={[styles.slide, styles.center]}>
              <Body color={colors.onDark}>Couldn't load this memory.</Body>
            </View>
          }
        />
      )}

      {items && items.length > 1 && (
        <Text style={[typeScale.small, styles.counter]}>
          {active + 1} / {items.length}
        </Text>
      )}

      <PressableScale
        style={styles.closeButton}
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Text style={styles.closeText}>✕</Text>
      </PressableScale>
    </View>
  );
}

function VideoSlide({ url }: { url: string }) {
  // Safari (web) blocks unmuted autoplay — there the native ▶ control starts it.
  const player = useVideoPlayer(url, (p) => {
    if (Platform.OS !== "web") p.play();
  });
  return (
    <VideoView playsInline
      player={player}
      style={styles.media}
      nativeControls
      contentFit="contain"
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.deepOcean },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  slide: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: "center",
    alignItems: "center",
  },
  media: { width: screenWidth, height: screenHeight },
  counter: {
    position: "absolute",
    top: 64,
    alignSelf: "center",
    color: colors.onDark,
  },
  closeButton: {
    position: "absolute",
    top: 56,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.warmWhite,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.lifted,
  },
  closeText: { color: colors.inkOcean, fontSize: 16, fontWeight: "700" },
});
