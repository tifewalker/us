import { Collage } from "@/components/memories/Collage";
import { SimpleViewer } from "@/components/memories/SimpleViewer";
import { SparkleBurst } from "@/components/moments/effects";
import { SongCard } from "@/components/music/SongCard";
import { usePreviewStopOnBlur } from "@/components/music/usePreviewStopOnBlur";
import {
    Body,
    Button,
    EmptyState,
    formatLongDate,
    Handwritten,
    PaperCard,
    PressableScale,
    ScreenBackground,
    successHaptic,
    tapHaptic,
    Title,
    WashiTape,
} from "@/components/ui";
import { getCurrentUser, getUserName } from "@/lib/auth";
import { getGift, markGiftOpened, signGiftMedia, type Gift } from "@/lib/gifts";
import type { ResolvedMedia } from "@/lib/memories";
import { colors, GUTTER, radius, shadows, space } from "@/theme";
import { Image } from "expo-image";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import Animated, {
    Easing,
    FadeIn,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";

// A sealed gift, opened. RLS only returns the row once it's unlocked (or to its
// sender), so a locked gift simply isn't there — we never fetch sealed content.
// The recipient's first open plays the unwrap moment (ribbon pulls, lid lifts,
// sparkle), then the letter, the song and the media.
export default function GiftScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  usePreviewStopOnBlur();

  const [state, setState] = useState<"loading" | "sealed" | "ready">("loading");
  const [gift, setGift] = useState<Gift | null>(null);
  const [isRecipient, setIsRecipient] = useState(false);
  const [fromName, setFromName] = useState<string | null>(null);
  const [items, setItems] = useState<ResolvedMedia[]>([]);
  const [unwrapping, setUnwrapping] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        const g = await getGift(id);
        if (!g) {
          setState("sealed");
          return;
        }
        setGift(g);
        const recipient = g.recipient_id === user.id;
        setIsRecipient(recipient);
        getUserName(g.sender_id).then((n) => setFromName(n?.trim().split(/\s+/)[0] ?? null)).catch(() => {});
        if (g.media?.length) {
          const urls = await signGiftMedia(g.media);
          setItems(
            g.media
              .filter((m) => urls[m.storage_path])
              .map((m) => ({
                id: m.storage_path,
                type: m.media_type,
                url: urls[m.storage_path],
                thumbUrl: m.media_type === "photo" ? urls[m.storage_path] : m.thumbnail_path ? (urls[m.thumbnail_path] ?? null) : null,
                cacheKey: m.storage_path,
                thumbCacheKey: m.media_type === "photo" ? m.storage_path : m.thumbnail_path,
                storagePath: m.storage_path,
                thumbnailPath: m.thumbnail_path,
                durationSeconds: m.duration_seconds,
              })),
          );
        }
        if (recipient && !g.opened_at) {
          setUnwrapping(true);
          markGiftOpened(g.id).catch((e) => console.log("[Gift] markOpened failed:", e.message));
        }
        setState("ready");
      } catch (err: any) {
        console.log("[Gift] load failed:", err.message);
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

  if (state === "sealed" || !gift) {
    return (
      <ScreenBackground>
        <EmptyState icon="gift" title="Still sealed" message="This surprise opens on its day. No peeking 🎁" actionLabel="Back to the beach" onAction={() => router.back()} style={styles.center} />
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground padded={false}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
        <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </PressableScale>

        <Title variant="titleItalic" center style={styles.title}>
          {isRecipient ? `From ${fromName ?? "your person"}, with love` : "Your surprise"}
        </Title>
        {!isRecipient && gift.unlock_at && (
          <Body variant="small" color={colors.inkSoft} center>
            {gift.opened_at
              ? `Opened ❤️ ${new Date(gift.opened_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
              : new Date(gift.unlock_at) > new Date()
                ? `Sealed until ${formatLongDate(new Date(gift.unlock_at))}`
                : "Unlocked — not opened yet"}
          </Body>
        )}

        <Animated.View entering={FadeIn.duration(600).delay(unwrapping ? 0 : 0)}>
          <PaperCard style={styles.letter}>
            <WashiTape color="coral" rotate={-4} style={styles.tape} />
            <Handwritten>{gift.message}</Handwritten>
            {fromName ? (
              <Handwritten variant="handSmall" color={colors.inkSoft} style={styles.signature}>
                — {isRecipient ? fromName : "you"}
              </Handwritten>
            ) : null}
          </PaperCard>

          {gift.song && <SongCard song={gift.song} style={styles.song} />}

          {items.length > 0 && (
            <View style={styles.collage}>
              <Collage items={items} width={width - GUTTER * 2} focused={focused && !unwrapping && viewer === null} onOpen={setViewer} onLongPress={() => {}} onMore={() => setViewer(5)} />
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {unwrapping && <Unwrap onDone={() => setUnwrapping(false)} />}

      <Modal visible={viewer !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setViewer(null)}>
        {viewer !== null && <SimpleViewer items={items} start={viewer} onClose={() => setViewer(null)} />}
      </Modal>
    </ScreenBackground>
  );
}

// The unwrap moment: the ribbon pulls away, the lid lifts, a short sparkle,
// then it fades to reveal the letter. Tap to skip. Reduce Motion: a fade.
function Unwrap({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const ribbon = useSharedValue(0);
  const lid = useSharedValue(0);
  const veil = useSharedValue(1);
  const [sparkle, setSparkle] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const size = Math.min(width * 0.6, 240);

  const finish = () => {
    timers.current.forEach(clearTimeout);
    ribbon.value = 1;
    lid.value = 1;
    veil.value = withTiming(0, { duration: 400 });
    timers.current = [setTimeout(onDone, 420)];
  };

  useEffect(() => {
    if (reduceMotion) {
      timers.current.push(setTimeout(finish, 700));
      return () => timers.current.forEach(clearTimeout);
    }
    const ease = Easing.out(Easing.cubic);
    tapHaptic();
    ribbon.value = withDelay(500, withTiming(1, { duration: 700, easing: ease }));
    lid.value = withDelay(1300, withTiming(1, { duration: 800, easing: ease }));
    timers.current.push(
      setTimeout(() => {
        setSparkle(true);
        successHaptic();
      }, 1700),
      setTimeout(() => {
        veil.value = withTiming(0, { duration: 700 });
      }, 2700),
      setTimeout(onDone, 3450),
    );
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ribbonH = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 - ribbon.value }], opacity: 1 - ribbon.value }));
  const ribbonV = useAnimatedStyle(() => ({ transform: [{ translateY: -ribbon.value * size * 0.6 }], opacity: 1 - ribbon.value }));
  const lidStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lid.value * size * 0.55 }, { rotate: `${-16 * lid.value}deg` }],
    opacity: 1 - Math.max(0, lid.value - 0.6) / 0.4,
  }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.unwrap, veilStyle]}>
      <Pressable style={styles.centerFill} onPress={finish} accessibilityRole="button" accessibilityLabel="Skip">
        <View style={{ width: size, height: size }}>
          {/* box */}
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Rect x={size * 0.08} y={size * 0.35} width={size * 0.84} height={size * 0.6} rx={6} fill={colors.sunset} />
            <Rect x={size * 0.08} y={size * 0.35} width={size * 0.84} height={size * 0.08} fill="#000" opacity={0.08} />
          </Svg>
          {/* vertical ribbon on the box */}
          <Animated.View style={[styles.abs, { left: size * 0.46, top: size * 0.35, width: size * 0.08, height: size * 0.6, backgroundColor: colors.warmWhite }, ribbonV]} />
          {/* lid + bow */}
          <Animated.View style={[styles.abs, { left: 0, top: size * 0.18, width: size, height: size * 0.22 }, lidStyle]}>
            <Svg width={size} height={size * 0.22}>
              <Rect x={0} y={size * 0.06} width={size} height={size * 0.16} rx={6} fill={colors.coral} />
              <Path
                d={`M${size / 2} ${size * 0.08} C${size * 0.38} ${-size * 0.04} ${size * 0.28} ${size * 0.06} ${size / 2} ${size * 0.08} C${size * 0.72} ${size * 0.06} ${size * 0.62} ${-size * 0.04} ${size / 2} ${size * 0.08} Z`}
                fill={colors.warmWhite}
              />
            </Svg>
          </Animated.View>
          {/* horizontal ribbon pulling away */}
          <Animated.View style={[styles.abs, { left: size * 0.08, top: size * 0.58, width: size * 0.84, height: size * 0.07, backgroundColor: colors.warmWhite, transformOrigin: "100% 50%" }, ribbonH]} />
        </View>
        {sparkle && <SparkleBurst x={width / 2} y={height / 2 - size * 0.2} seed="gift" />}
        <Body color={colors.onDarkSoft} style={styles.unwrapHint}>
          Tap to open
        </Body>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  abs: { position: "absolute" },
  content: { paddingHorizontal: GUTTER },
  back: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.warmWhite,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.lifted,
  },
  backText: { color: colors.inkOcean, fontSize: 22, lineHeight: 26, fontWeight: "700" },
  title: { marginTop: space.lg, marginBottom: space.xs },
  letter: { marginTop: space.xl, padding: space.xl, transform: [{ rotate: "-0.8deg" }] },
  tape: { position: "absolute", top: -10, left: space.xl },
  signature: { textAlign: "right", marginTop: space.sm },
  song: { marginTop: space.xl, marginLeft: space.xl },
  collage: { marginTop: space.xl },
  unwrap: { backgroundColor: colors.deepOcean, zIndex: 30 },
  unwrapHint: { marginTop: space.xxl },
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
