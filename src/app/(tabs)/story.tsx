import {
    BeginningPage,
    FootprintTrail,
    MemoryCluster,
    MonthHeading,
    type ClusterPhoto,
    type JournalMemory,
} from "@/components/memories/journal";
import {
    EmptyState,
    PressableScale,
    ScreenBackground,
    Title,
    useTabBarClearance,
} from "@/components/ui";
import { getMyCouple } from "@/lib/couples";
import { getMemoriesForCouple, signPaths } from "@/lib/memories";
import { memoriesWithBothSides } from "@/lib/reflections";
import { colors, GUTTER, radius, space, type as typeScale } from "@/theme";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
    type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SIGN_AHEAD = 8; // rows past the last visible one to sign in advance

type MediaRow = { id: string; media_type: string; storage_path: string; thumbnail_path: string | null; duration_seconds: number | null };
type Entry = JournalMemory & { media: MediaRow[] };

type Row =
  | { kind: "month"; key: string; label: string }
  | { kind: "memory"; key: string; entry: Entry; side: "left" | "right"; index: number; trail: boolean }
  | { kind: "beginning"; key: string }
  | { kind: "empty"; key: string };

function parseDate(dateStr: string | null, createdAt: string): Date {
  if (dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(createdAt);
}

// The first 3 visual items of a memory → the storage path to show for each.
function clusterPaths(media: MediaRow[]) {
  return media
    .slice(0, 3)
    .map((m) => (m.media_type === "photo" ? m.storage_path : m.thumbnail_path))
    .filter((p): p is string => !!p);
}

export default function Story() {
  const insets = useSafeAreaInsets();
  const tabClearance = useTabBarClearance();
  const { width } = useWindowDimensions();
  const contentWidth = width - GUTTER * 2;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [start, setStart] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [newestFirst, setNewestFirst] = useState(true);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const couple = await getMyCouple();
      if (!couple) return;
      const [y, m, d] = String(couple.relationship_start).split("-").map(Number);
      setStart(new Date(y, m - 1, d));
      const rows = await getMemoriesForCouple(couple.id);
      const both = await memoriesWithBothSides(rows.map((r: any) => r.id)).catch(() => new Set<string>());
      setEntries(
        rows.map((r: any) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          location: r.location,
          date: parseDate(r.memory_date, r.created_at),
          hasSong: !!r.song,
          bothSides: both.has(r.id),
          media: (r.memory_media ?? []).filter((m: MediaRow) => m.media_type !== "voice"), // voice notes have no picture
        })),
      );
      // Signed URLs expire; re-sign on each visit (images stay cached by storage path).
      requested.current = new Set();
      setUrls({});
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever the tab gains focus (new / edited / deleted memories show up).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const rows = useMemo<Row[]>(() => {
    const sorted = [...entries].sort((a, b) =>
      newestFirst ? b.date.getTime() - a.date.getTime() : a.date.getTime() - b.date.getTime(),
    );
    const out: Row[] = [];
    if (!newestFirst) out.push({ kind: "beginning", key: "beginning" });
    if (sorted.length === 0) out.push({ kind: "empty", key: "empty" });
    let lastMonth = "";
    sorted.forEach((entry, i) => {
      const label = `${MONTHS[entry.date.getMonth()]} ${entry.date.getFullYear()}`;
      if (label !== lastMonth) {
        out.push({ kind: "month", key: `m-${label}`, label });
        lastMonth = label;
      }
      out.push({
        kind: "memory",
        key: entry.id,
        entry,
        side: i % 2 === 0 ? "left" : "right",
        index: i,
        trail: i < sorted.length - 1 || newestFirst, // path leads on to the next memory / the beginning
      });
    });
    if (newestFirst) out.push({ kind: "beginning", key: "beginning" });
    return out;
  }, [entries, newestFirst]);

  // Sign one "page" of rows at a time, in a single createSignedUrls request.
  const ensureSigned = useCallback(async (upTo: number, source: Row[]) => {
    const paths: string[] = [];
    for (const row of source.slice(0, upTo + 1)) {
      if (row.kind !== "memory") continue;
      for (const p of clusterPaths(row.entry.media)) {
        if (!requested.current.has(p)) {
          requested.current.add(p);
          paths.push(p);
        }
      }
    }
    if (paths.length === 0) return;
    try {
      const signed = await signPaths(paths, 3600);
      setUrls((prev) => ({ ...prev, ...signed }));
    } catch (e: any) {
      paths.forEach((p) => requested.current.delete(p));
      console.log("[Story] signing failed:", e.message);
    }
  }, []);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  // First page as soon as rows exist (and again after a reload/re-sort).
  useEffect(() => {
    if (rows.length) ensureSigned(SIGN_AHEAD, rows);
  }, [rows, ensureSigned]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const last = Math.max(-1, ...viewableItems.map((v) => v.index ?? -1));
    if (last >= 0) ensureSigned(last + SIGN_AHEAD, rowsRef.current);
  }).current;

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      switch (item.kind) {
        case "month":
          return <MonthHeading label={item.label} />;
        case "beginning":
          return <BeginningPage date={start} />;
        case "empty":
          return (
            <EmptyState
              icon="camera"
              message="Your story starts with one memory"
              actionLabel="Add a memory"
              onAction={() => router.push("/memory/create")}
              style={styles.empty}
            />
          );
        case "memory": {
          const photos: ClusterPhoto[] = item.entry.media.slice(0, 3).map((m) => {
            const path = m.media_type === "photo" ? m.storage_path : m.thumbnail_path;
            return {
              id: m.id,
              uri: path ? (urls[path] ?? null) : null,
              cacheKey: path,
              isVideo: m.media_type === "video",
              duration: m.duration_seconds,
            };
          });
          return (
            <View>
              <MemoryCluster
                memory={item.entry}
                photos={photos}
                side={item.side}
                index={item.index}
                contentWidth={contentWidth}
                onPress={() => router.push(`/memory/${item.entry.id}`)}
              />
              {item.trail && <FootprintTrail from={item.side} width={contentWidth} />}
            </View>
          );
        }
      }
    },
    [urls, start, contentWidth],
  );

  if (loading) {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground padded={false}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderItem}
        extraData={urls}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 10 }}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
        contentContainerStyle={[
          styles.list,
          { paddingTop: insets.top + space.xl, paddingBottom: tabClearance },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Title variant="titleItalic">Our story</Title>
            {entries.length > 1 && (
              <View style={styles.toggle} accessibilityRole="radiogroup">
                <SortChip label="Newest" selected={newestFirst} onPress={() => setNewestFirst(true)} />
                <SortChip label="Oldest" selected={!newestFirst} onPress={() => setNewestFirst(false)} />
              </View>
            )}
          </View>
        }
      />
    </ScreenBackground>
  );
}

function SortChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} first`}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <Text style={[typeScale.small, { color: selected ? colors.onDark : colors.inkSoft }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { paddingHorizontal: GUTTER },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggle: { flexDirection: "row", gap: space.xs, backgroundColor: colors.paperDeep, borderRadius: radius.pill, padding: 3 },
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill },
  chipOn: { backgroundColor: colors.ocean },
  empty: { marginTop: space.xl },
});
