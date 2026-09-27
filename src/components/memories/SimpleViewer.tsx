import type { ResolvedMedia } from "@/lib/memories";
import { colors, space } from "@/theme";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// A plain full-screen, swipeable viewer for a list of resolved media (used by
// gifts and bottles, whose media isn't a memory — memory/viewer needs a memoryId).
// Render it inside a transparent Modal.
export function SimpleViewer({ items, start, onClose }: { items: ResolvedMedia[]; start: number; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(Math.min(start, items.length - 1));
  return (
    <View style={styles.viewer}>
      <FlatList
        data={items}
        horizontal
        pagingEnabled
        keyExtractor={(m) => m.id}
        initialScrollIndex={Math.min(start, items.length - 1)}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setActive(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index }) => (
          <View style={{ width, height, justifyContent: "center" }}>
            {item.type === "video" && index === active ? (
              <ViewerVideo url={item.url} />
            ) : (
              <Image source={{ uri: item.type === "video" ? (item.thumbUrl ?? item.url) : item.url, cacheKey: item.cacheKey }} style={{ width, height }} contentFit="contain" />
            )}
          </View>
        )}
      />
      <Pressable onPress={onClose} style={[styles.viewerClose, { top: insets.top + space.md }]} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
        <Text style={styles.viewerCloseText}>✕</Text>
      </Pressable>
    </View>
  );
}

function ViewerVideo({ url }: { url: string }) {
  // Safari (web) blocks unmuted autoplay — there the native ▶ control starts it.
  const player = useVideoPlayer(url, (p) => {
    if (Platform.OS !== "web") p.play();
  });
  return <VideoView playsInline player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain" />;
}


const styles = StyleSheet.create({
  viewer: { flex: 1, backgroundColor: colors.deepOcean },
  viewerClose: {
    position: "absolute",
    right: space.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.warmWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerCloseText: { color: colors.inkOcean, fontSize: 16, fontWeight: "700" },
});
