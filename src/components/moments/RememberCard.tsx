import { Body, Button, Handwritten, PressableScale, successHaptic, Title } from "@/components/ui";
import { stopPreview, togglePreview, usePreviewState, type Song } from "@/lib/music";
import { agoLabel, getHeartsToday, heartToday } from "@/lib/remember";
import { colors, radius, shadows, space, type as typeScale } from "@/theme";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FloatingHearts } from "./effects";

export type RememberMemory = {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  song: Song | null;
  imageUrl: string | null;
  cacheKey: string | null;
};

// Full-screen "Remember when…" card: the photo, how long ago, the title, the
// first line in Caveat, the song ▶. "❤️ I remember" hearts it for today; when
// both of you have: "You both remembered this ❤️".
export function RememberCard({
  memory,
  myId,
  onClose,
  onWrite,
  onOpen,
}: {
  memory: RememberMemory;
  myId: string;
  onClose: () => void;
  onWrite: () => void;
  onOpen: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [hearts, setHearts] = useState<string[]>([]);
  const [burst, setBurst] = useState(false);
  const preview = usePreviewState();
  const playing = !!memory.song && preview.songId === memory.song.itunesId && preview.playing;
  const firstLine = memory.description?.split("\n").find((l) => l.trim())?.trim();
  const photo = Math.min(width - space.xl * 2, 360);

  useEffect(() => {
    getHeartsToday(memory.id).then(setHearts).catch(() => {});
    return () => stopPreview();
  }, [memory.id]);

  const iHearted = hearts.includes(myId);
  const both = new Set(hearts).size >= 2;

  async function heart() {
    if (iHearted) return;
    setHearts((h) => [...h, myId]);
    successHaptic();
    setBurst(true);
    try {
      await heartToday(memory.id, myId);
      setHearts(await getHeartsToday(memory.id));
    } catch (e: any) {
      console.log("[Remember] heart failed:", e.message);
    }
  }

  return (
    <Animated.View entering={FadeIn.duration(350)} exiting={FadeOut.duration(300)} style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}>
        <Handwritten color={colors.sand} center>
          Remember when…
        </Handwritten>
        <View style={[styles.frame, { width: photo + 20 }]}>
          <View style={{ width: photo, height: photo * 0.9, backgroundColor: colors.paperDeep }}>
            {memory.imageUrl ? (
              <Image source={{ uri: memory.imageUrl, cacheKey: memory.cacheKey ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: "30%", left: "50%" }} />
            ) : null}
          </View>
          <Body variant="small" color={colors.inkSoft} center style={styles.ago}>
            {agoLabel(memory.date)}
          </Body>
        </View>

        <Title variant="titleItalic" color={colors.onDark} center style={styles.title}>
          {memory.title}
        </Title>
        {firstLine ? (
          <Handwritten color={colors.warmWhite} center numberOfLines={3}>
            {firstLine}
          </Handwritten>
        ) : null}

        {memory.song?.previewUrl ? (
          <PressableScale onPress={() => togglePreview(memory.song!)} accessibilityRole="button" accessibilityLabel={playing ? "Pause the song" : `Play ${memory.song.title}`} style={styles.song}>
            <Text style={[typeScale.button, { color: colors.inkOcean }]}>{playing ? "❚❚" : "▶"}</Text>
            <Text style={[typeScale.small, { color: colors.inkOcean, flexShrink: 1 }]} numberOfLines={1}>
              {memory.song.title} · {memory.song.artist}
            </Text>
          </PressableScale>
        ) : null}

        {both && (
          <Title variant="headingItalic" color={colors.coral} center style={styles.both}>
            You both remembered this ❤️
          </Title>
        )}

        <View style={styles.actions}>
          <Button title={iHearted ? "❤️ You remembered" : "❤️ I remember"} onPress={heart} disabled={iHearted} />
          <Button title="Write what I remember" variant="soft" onPress={onWrite} />
          <Button title="Open memory" variant="soft" onPress={onOpen} />
          <Button title="Close" variant="text" onPress={onClose} />
        </View>
      </ScrollView>
      {burst && <FloatingHearts width={width} height={height * 0.6} count={10} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(7,26,43,0.94)" },
  content: { alignItems: "center", paddingHorizontal: space.xl, gap: space.sm },
  frame: {
    backgroundColor: colors.warmWhite,
    padding: 10,
    paddingBottom: space.md,
    borderRadius: radius.photo,
    marginTop: space.md,
    transform: [{ rotate: "-1.5deg" }],
    ...shadows.floating,
  },
  ago: { marginTop: space.sm },
  title: { marginTop: space.lg },
  song: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.sand,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    marginTop: space.md,
    maxWidth: "100%",
  },
  both: { marginTop: space.md },
  actions: { alignSelf: "stretch", gap: space.sm, marginTop: space.xl },
});
