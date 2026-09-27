import { EmptyState, Input, PressableScale, Sheet, Title } from "@/components/ui";
import { resolveLinks, searchSongs, stopPreview, togglePreview, usePreviewState, type Song } from "@/lib/music";
import { colors, radius, space, type as typeScale } from "@/theme";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, useWindowDimensions, View } from "react-native";

// Search iTunes (debounced ~350ms), ▶ to preview, tap a row to choose.
// Choosing resolves the platform links once (Odesli) before handing it back.
export function SongPicker({
  visible,
  onClose,
  onChoose,
}: {
  visible: boolean;
  onClose: () => void;
  onChoose: (song: Song) => void;
}) {
  const { height } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<number | null>(null);
  const preview = usePreviewState();
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!visible) {
      stopPreview();
      return;
    }
  }, [visible]);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      setError(null);
      return;
    }
    const t = setTimeout(async () => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setSearching(true);
      try {
        setResults(await searchSongs(term, controller.signal));
        setError(null);
      } catch (e: any) {
        if (e?.name !== "AbortError") setError("Couldn't search right now — try again?");
      } finally {
        if (abort.current === controller) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  async function choose(song: Song) {
    setChoosing(song.itunesId);
    stopPreview();
    const resolved = await resolveLinks(song); // never throws; falls back to a Spotify search link
    setChoosing(null);
    onChoose(resolved);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Title variant="heading">Pick a song</Title>
      <View style={styles.search}>
        <Input
          placeholder="Song or artist"
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search for a song"
        />
      </View>

      <View style={{ height: height * 0.5 }}>
        {searching && results.length === 0 ? (
          <ActivityIndicator color={colors.ocean} style={styles.spinner} />
        ) : results.length === 0 ? (
          <EmptyState icon="musicalNotes" message={error ?? (query.trim() ? "No songs found — try another search." : "Search for a song you both love")} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(s) => String(s.itunesId)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const playing = preview.songId === item.itunesId && preview.playing;
              return (
                <PressableScale
                  onPress={() => choose(item)}
                  disabled={choosing !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${item.title} by ${item.artist}`}
                  style={styles.row}
                >
                  {item.artworkUrl ? (
                    <Image source={{ uri: item.artworkUrl }} style={styles.art} contentFit="cover" />
                  ) : (
                    <View style={[styles.art, styles.artEmpty]} />
                  )}
                  <View style={styles.rowText}>
                    <Text style={[typeScale.bodyStrong, { color: colors.ink }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[typeScale.small, { color: colors.inkSoft }]} numberOfLines={1}>
                      {item.artist}
                    </Text>
                  </View>
                  {choosing === item.itunesId ? (
                    <ActivityIndicator color={colors.ocean} />
                  ) : item.previewUrl ? (
                    <PressableScale
                      onPress={() => togglePreview(item)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={playing ? "Pause preview" : "Play preview"}
                      style={[styles.play, playing && styles.playOn]}
                    >
                      <Text style={[typeScale.button, { color: playing ? colors.onDark : colors.ocean, fontSize: 13 }]}>
                        {playing ? "❚❚" : "▶"}
                      </Text>
                    </PressableScale>
                  ) : null}
                </PressableScale>
              );
            }}
          />
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  search: { marginTop: space.md },
  spinner: { marginTop: space.xl },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  art: { width: 52, height: 52, borderRadius: radius.photo },
  artEmpty: { backgroundColor: colors.paperDeep },
  rowText: { flex: 1 },
  play: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: colors.ocean,
    alignItems: "center",
    justifyContent: "center",
  },
  playOn: { backgroundColor: colors.ocean },
});
