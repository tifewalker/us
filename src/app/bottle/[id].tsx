import { Collage } from "@/components/memories/Collage";
import { SimpleViewer } from "@/components/memories/SimpleViewer";
import { BottleUnroll } from "@/components/moments/BottleMoments";
import { SongCard } from "@/components/music/SongCard";
import { VoiceTag } from "@/components/voice/VoiceTag";
import { usePreviewStopOnBlur } from "@/components/music/usePreviewStopOnBlur";
import {
    Body,
    EmptyState,
    formatLongDate,
    Handwritten,
    PaperCard,
    PressableScale,
    ScreenBackground,
    Title,
    WashiTape,
} from "@/components/ui";
import { getCurrentUser, getUserName } from "@/lib/auth";
import { getGift, markGiftOpened, resolveGiftMedia, type Gift } from "@/lib/gifts";
import type { ResolvedMedia } from "@/lib/memories";
import { colors, GUTTER, radius, shadows, space } from "@/theme";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// A bottle (or an open-when note), opened. RLS only returns it once it has
// arrived (or to its sender) — a drifting bottle simply isn't there. The
// recipient's first open plays the unroll moment and marks opened_at.
export default function BottleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  usePreviewStopOnBlur();

  const [state, setState] = useState<"loading" | "sealed" | "ready">("loading");
  const [bottle, setBottle] = useState<Gift | null>(null);
  const [isRecipient, setIsRecipient] = useState(false);
  const [fromName, setFromName] = useState<string | null>(null);
  const [items, setItems] = useState<ResolvedMedia[]>([]);
  const [unrolling, setUnrolling] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        const b = await getGift(id);
        if (!b) return setState("sealed");
        setBottle(b);
        const recipient = b.recipient_id === user.id;
        setIsRecipient(recipient);
        getUserName(b.sender_id).then((n) => setFromName(n?.trim().split(/\s+/)[0] ?? null)).catch(() => {});
        setItems(await resolveGiftMedia(b.media ?? []));
        if (recipient && !b.opened_at) {
          setUnrolling(true);
          markGiftOpened(b.id).catch((e) => console.log("[Bottle] markOpened failed:", e.message));
        }
        setState("ready");
      } catch (err: any) {
        console.log("[Bottle] load failed:", err.message);
        setState("sealed");
      }
    })();
  }, [id]);

  if (state === "loading") {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </ScreenBackground>
    );
  }
  if (state === "sealed" || !bottle) {
    return (
      <ScreenBackground>
        <EmptyState icon="bottle" title="Still drifting" message="This bottle hasn't washed up yet." actionLabel="Back to the beach" onAction={() => router.back()} style={styles.center} />
      </ScreenBackground>
    );
  }

  // photos/videos in the collage (+ viewer, same indexes); voice notes as tags,
  // shown (and playable) only after the unroll moment
  const visual = items.filter((m) => m.type !== "voice");
  const voices = unrolling ? [] : items.filter((m) => m.type === "voice");
  const heading = bottle.kind === "open_when" ? `Open when ${bottle.open_when_label}` : isRecipient ? "Something washed ashore for you" : "Your bottle";

  return (
    <ScreenBackground padded={false}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </PressableScale>
        <Title variant="titleItalic" center style={styles.title}>
          {heading}
        </Title>
        <Body variant="small" color={colors.inkSoft} center>
          {isRecipient
            ? `From ${fromName ?? "your person"}${bottle.opened_at && !unrolling ? ` · opened ${formatLongDate(new Date(bottle.opened_at))}` : ""}`
            : bottle.opened_at
              ? `Opened ❤️ ${formatLongDate(new Date(bottle.opened_at))}`
              : bottle.kind === "open_when"
                ? "Waiting in the jar"
                : bottle.unlock_at && new Date(bottle.unlock_at) > new Date()
                  ? `Arrives ${formatLongDate(new Date(bottle.unlock_at))}`
                  : "Washed ashore — not opened yet"}
        </Body>

        <Animated.View entering={FadeIn.duration(600)}>
          <PaperCard style={styles.letter}>
            <WashiTape color="sky" rotate={-4} style={styles.tape} />
            <Handwritten>{bottle.message}</Handwritten>
            {fromName ? (
              <Handwritten variant="handSmall" color={colors.inkSoft} style={styles.signature}>
                — {isRecipient ? fromName : "you"}
              </Handwritten>
            ) : null}
          </PaperCard>
          {bottle.song && <SongCard song={bottle.song} style={styles.song} />}
          {voices.length > 0 && (
            <View style={styles.voices}>
              {voices.map((v, i) => (
                <VoiceTag
                  key={v.id}
                  id={v.id}
                  playKey={v.storagePath}
                  uri={v.url}
                  durationSeconds={v.durationSeconds ?? 0}
                  waveform={v.waveform ?? []}
                  label={`voice note ${voices.length > 1 ? i + 1 : ""}`.trim()}
                  style={[styles.voiceTag, i % 2 === 1 && styles.voiceTagRight]}
                />
              ))}
            </View>
          )}
          {visual.length > 0 && (
            <View style={styles.collage}>
              <Collage items={visual} width={width - GUTTER * 2} focused={focused && !unrolling && viewer === null} onOpen={setViewer} onLongPress={() => {}} onMore={() => setViewer(5)} />
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {unrolling && <BottleUnroll label={bottle.kind === "open_when" ? `Open when ${bottle.open_when_label}` : "Something washed ashore for you"} onDone={() => setUnrolling(false)} />}

      <Modal visible={viewer !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewer(null)}>
        {viewer !== null && <SimpleViewer items={visual} start={viewer} onClose={() => setViewer(null)} />}
      </Modal>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: GUTTER },
  back: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.warmWhite, alignItems: "center", justifyContent: "center", ...shadows.lifted },
  backText: { color: colors.inkOcean, fontSize: 22, lineHeight: 26, fontWeight: "700" },
  title: { marginTop: space.lg, marginBottom: space.xs },
  letter: { marginTop: space.xl, padding: space.xl, transform: [{ rotate: "0.6deg" }] },
  tape: { position: "absolute", top: -10, left: space.xl },
  signature: { textAlign: "right", marginTop: space.sm },
  song: { marginTop: space.xl, marginLeft: space.xl },
  collage: { marginTop: space.xl },
  voices: { marginTop: space.xl, gap: space.lg },
  voiceTag: { width: "88%" },
  voiceTagRight: { alignSelf: "flex-end" },
});
