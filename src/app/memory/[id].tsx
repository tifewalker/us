import { Collage } from "@/components/memories/Collage";
import { Perspectives } from "@/components/memories/Perspectives";
import { getCurrentUser, getUserName } from "@/lib/auth";
import { getMyCouple } from "@/lib/couples";
import { SongCard } from "@/components/music/SongCard";
import { usePreviewStopOnBlur } from "@/components/music/usePreviewStopOnBlur";
import { MediaGrid } from "@/components/memories/MediaGrid";
import {
    ActionSheet,
    Body,
    Button,
    ConfirmSheet,
    EmptyState,
    formatLongDate,
    PaperCard,
    PressableScale,
    ScreenBackground,
    Title,
} from "@/components/ui";
import {
    deleteMemory,
    getMemoryById,
    removeMediaItem,
    resolveMedia,
    type ResolvedMedia,
} from "@/lib/memories";
import { colors, GUTTER, radius, shadows, space } from "@/theme";
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MODAL_GAP = 350; // let one modal finish closing before the next opens (iOS)

function parseDate(s: string | null) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function MemoryPage() {
  // ?section=reflect opens the page scrolled to "What do you remember?"
  const { id, section } = useLocalSearchParams<{ id: string; section?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  usePreviewStopOnBlur();

  const [memory, setMemory] = useState<any>(null);
  const [media, setMedia] = useState<ResolvedMedia[]>([]);
  const [loading, setLoading] = useState(true);

  const [menuOpen, setMenuOpen] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [people, setPeople] = useState<{ myId: string; myName: string; partnerName: string } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [reflectY, setReflectY] = useState<number | null>(null);
  const scrolledToSection = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getMemoryById(id);
      setMemory(data);
      if (!people) {
        const [user, couple] = await Promise.all([getCurrentUser(), getMyCouple()]);
        const partnerId = couple ? (couple.partner_one === user.id ? couple.partner_two : couple.partner_one) : null;
        const [me, them] = await Promise.all([getUserName(user.id), partnerId ? getUserName(partnerId) : Promise.resolve(null)]);
        const first = (n: string | null, fallback: string) => (n ? n.trim().split(/\s+/)[0] : fallback);
        setPeople({ myId: user.id, myName: first(me, "You"), partnerName: first(them, "Your partner") });
      }
      setMedia(await resolveMedia(data.memory_media ?? []));
    } catch (err: any) {
      console.log("[MemoryPage] load failed:", err.message);
      setMemory(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (section === "reflect" && reflectY !== null && !scrolledToSection.current) {
      scrolledToSection.current = true;
      setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, reflectY - 80), animated: true }), 300);
    }
  }, [section, reflectY]);

  // Reload on every focus, so edits / added / removed photos show on return.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openViewer(index: number) {
    router.push({ pathname: "/memory/viewer", params: { memoryId: id, index: String(index) } });
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteMemory(id);
      setConfirmDelete(false);
      router.back();
    } catch (err: any) {
      setConfirmDelete(false);
      setTimeout(() => Alert.alert("Couldn't delete this memory", err.message ?? String(err)), MODAL_GAP);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveItem() {
    if (removeIndex === null) return;
    const item = media[removeIndex];
    setBusy(true);
    try {
      await removeMediaItem({ id: item.id, storage_path: item.storagePath, thumbnail_path: item.thumbnailPath });
      setRemoveIndex(null);
      await load();
    } catch (err: any) {
      setRemoveIndex(null);
      setTimeout(() => Alert.alert("Couldn't remove that", err.message ?? String(err)), MODAL_GAP);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </ScreenBackground>
    );
  }

  if (!memory) {
    return (
      <ScreenBackground>
        <EmptyState icon="shell" message="Couldn't find this memory." actionLabel="Go back" onAction={() => router.back()} style={styles.center} />
      </ScreenBackground>
    );
  }

  const date = parseDate(memory.memory_date);
  const photoCount = media.filter((m) => m.type === "photo").length;
  const videoCount = media.filter((m) => m.type === "video").length;
  const contentWidth = width - GUTTER * 2;
  const removing = removeIndex !== null ? media[removeIndex] : null;

  return (
    <ScreenBackground padded={false}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl },
        ]}
      >
        <View style={styles.topBar}>
          <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={styles.roundButton}>
            <Text style={styles.roundText}>‹</Text>
          </PressableScale>
          <PressableScale onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="More options" style={styles.roundButton}>
            <Text style={styles.roundText}>…</Text>
          </PressableScale>
        </View>

        {media.length > 0 ? (
          <Collage
            items={media}
            width={contentWidth}
            focused={focused}
            onOpen={openViewer}
            onLongPress={setRemoveIndex}
            onMore={() => setGridOpen(true)}
          />
        ) : (
          <EmptyState
            icon="camera"
            message="No photos or videos in this memory yet."
            actionLabel="Add photos or videos"
            onAction={() => router.push({ pathname: "/memory/add-media", params: { id } })}
          />
        )}

        {memory.song ? <SongCard song={memory.song} style={styles.song} /> : null}

        <Title variant="title" style={styles.title}>
          {memory.title}
        </Title>
        {(date || memory.location) && (
          <Body variant="small" color={colors.inkSoft} style={styles.meta}>
            {[date ? formatLongDate(date) : null, memory.location].filter(Boolean).join(" · ")}
          </Body>
        )}

        {memory.description ? (
          <PaperCard style={styles.description}>
            <Body variant="bodyLarge" style={styles.descriptionText}>
              {memory.description}
            </Body>
          </PaperCard>
        ) : null}

        {media.length > 0 && (
          <Button
            title="Play this memory"
            icon="film"
            onPress={() => router.push({ pathname: "/memory/reel", params: { id } })}
            style={styles.play}
          />
        )}
        {media.length > 0 && (
          <Body variant="small" color={colors.inkSoft} center style={styles.counts}>
            {[photoCount && `${photoCount} ${photoCount === 1 ? "photo" : "photos"}`, videoCount && `${videoCount} ${videoCount === 1 ? "video" : "videos"}`]
              .filter(Boolean)
              .join(", ")}
          </Body>
        )}

        {people && (
          <View onLayout={(e) => setReflectY(e.nativeEvent.layout.y)}>
            <Perspectives memoryId={id} myId={people.myId} myName={people.myName} partnerName={people.partnerName} />
          </View>
        )}
      </ScrollView>

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        actions={[
          { label: "Edit", icon: "loveLetter", onPress: () => router.push({ pathname: "/memory/edit", params: { id } }) },
          { label: "Add photos or videos", icon: "camera", onPress: () => router.push({ pathname: "/memory/add-media", params: { id } }) },
          { label: "Delete", icon: "wave", destructive: true, onPress: () => setConfirmDelete(true) },
        ]}
      />

      <MediaGrid
        visible={gridOpen}
        items={media}
        onClose={() => setGridOpen(false)}
        onOpen={(i) => {
          setGridOpen(false);
          setTimeout(() => openViewer(i), MODAL_GAP);
        }}
        onLongPress={(i) => {
          setGridOpen(false);
          setTimeout(() => setRemoveIndex(i), MODAL_GAP);
        }}
      />

      <ConfirmSheet
        visible={confirmDelete}
        title="Delete this memory?"
        message="Its photos and videos will be removed for both of you."
        confirmLabel="Delete memory"
        cancelLabel="Keep it"
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmSheet
        visible={removing !== null}
        title={removing?.type === "video" ? "Remove this video?" : "Remove this photo?"}
        message="It will be taken out of this memory for both of you."
        confirmLabel="Remove from memory"
        cancelLabel="Keep it"
        busy={busy}
        onConfirm={handleRemoveItem}
        onCancel={() => setRemoveIndex(null)}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: GUTTER },
  topBar: { flexDirection: "row", justifyContent: "space-between", marginBottom: space.lg },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.warmWhite,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.lifted,
  },
  roundText: { color: colors.inkOcean, fontSize: 22, lineHeight: 26, fontWeight: "700" },
  song: { marginTop: space.xl, marginLeft: space.xl },
  title: { marginTop: space.xl },
  meta: { marginTop: space.xs },
  description: { marginTop: space.xl, padding: space.xl },
  // Comfortable reading: generous line height, capped line length on wide screens.
  descriptionText: { lineHeight: 28, maxWidth: 560 },
  play: { marginTop: space.xxl },
  counts: { marginTop: space.sm },
});
