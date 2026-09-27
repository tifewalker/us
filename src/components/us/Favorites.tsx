import { SongCard } from "@/components/music/SongCard";
import { SongPicker } from "@/components/music/SongPicker";
import { Body, Button, Handwritten, Input, PressableScale, seededTilt, Sheet, Title } from "@/components/ui";
import type { Song } from "@/lib/music";
import { deleteFavorite, FAVORITE_SUGGESTIONS, getFavorites, saveFavorite, type Favorite, type FavoriteKind } from "@/lib/us";
import { colors, fonts, radius, shadows, space, tape, type as typeScale } from "@/theme";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SectionHeading } from "./SectionHeading";

const TINTS = [colors.warmWhite, tape.sky, tape.mint, colors.sand, tape.coral];

// "Our favorites": small labelled objects scattered on the page — the song is
// a SongCard (vinyl), everything else a handwritten label on a paper scrap.
export function Favorites({ coupleId, myId, refreshKey }: { coupleId: string; myId: string; refreshKey: number }) {
  const [items, setItems] = useState<Favorite[]>([]);
  const [sheet, setSheet] = useState<{ open: boolean; editing: Favorite | null; kind?: FavoriteKind; label?: string }>({ open: false, editing: null });

  const load = () => getFavorites(coupleId).then(setItems).catch((e) => console.log("[Favorites]", e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, refreshKey]);

  const songs = items.filter((f) => f.kind === "song" && f.song);
  const others = items.filter((f) => !(f.kind === "song" && f.song));
  const missing = FAVORITE_SUGGESTIONS.filter((s) => !items.some((f) => f.kind === s.kind && f.label === s.label));

  return (
    <View>
      <SectionHeading icon="star" title="Our favorites" action="Add" onAction={() => setSheet({ open: true, editing: null })} />
      {songs.map((f) => (
        <PressableScale key={f.id} onPress={() => setSheet({ open: true, editing: f })} accessibilityLabel={`${f.label}. Edit`} scaleTo={0.98} style={styles.song}>
          <Body variant="label" color={colors.inkSoft} style={styles.songLabel}>
            {f.label}
          </Body>
          <SongCard song={f.song!} compact />
        </PressableScale>
      ))}
      <View style={styles.scraps}>
        {others.map((f, i) => (
          <PressableScale
            key={f.id}
            onPress={() => setSheet({ open: true, editing: f })}
            accessibilityRole="button"
            accessibilityLabel={`${f.label}: ${f.value ?? ""}. Edit`}
            style={[styles.scrap, { backgroundColor: TINTS[i % TINTS.length], transform: [{ rotate: `${seededTilt(f.id, 3)}deg` }] }]}
          >
            <Text style={[typeScale.small, styles.scrapLabel]}>{f.label}</Text>
            <Handwritten variant="handSmall">{f.value || "—"}</Handwritten>
          </PressableScale>
        ))}
      </View>
      {missing.length > 0 && (
        <View style={styles.suggestions}>
          {missing.map((s) => (
            <PressableScale key={s.label} onPress={() => setSheet({ open: true, editing: null, kind: s.kind, label: s.label })} accessibilityRole="button" accessibilityLabel={`Add ${s.label}`} style={styles.blank}>
              <Text style={[typeScale.small, styles.blankText]}>+ {s.label.toLowerCase()}</Text>
            </PressableScale>
          ))}
        </View>
      )}

      <FavoriteSheet
        visible={sheet.open}
        editing={sheet.editing}
        initialKind={sheet.kind}
        initialLabel={sheet.label}
        onClose={() => setSheet({ open: false, editing: null })}
        onSave={async (fav) => {
          await saveFavorite({ ...fav, coupleId, myId });
          await load();
        }}
        onDelete={async (id) => {
          await deleteFavorite(id);
          await load();
        }}
      />
    </View>
  );
}

function FavoriteSheet({
  visible,
  editing,
  initialKind,
  initialLabel,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  editing: Favorite | null;
  initialKind?: FavoriteKind;
  initialLabel?: string;
  onClose: () => void;
  onSave: (f: { id?: string; kind: FavoriteKind; label: string; value: string | null; song: Song | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [kind, setKind] = useState<FavoriteKind>("custom");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [song, setSong] = useState<Song | null>(null);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setKind(editing?.kind ?? initialKind ?? "custom");
    setLabel(editing?.label ?? initialLabel ?? "");
    setValue(editing?.value ?? "");
    setSong(editing?.song ?? null);
  }, [visible, editing, initialKind, initialLabel]);

  const suggestion = FAVORITE_SUGGESTIONS.find((s) => s.kind === kind);
  const canSave = label.trim() && (kind === "song" ? !!song : value.trim());

  async function save() {
    setBusy(true);
    try {
      await onSave({ id: editing?.id, kind, label, value: kind === "song" ? null : value, song: kind === "song" ? song : null });
      onClose();
    } catch (err: any) {
      Alert.alert("Couldn't save", err.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={busy ? () => {} : onClose}>
      <Title variant="heading">{editing ? editing.label : "A favorite of ours"}</Title>
      {!editing && (
        <View style={styles.chips}>
          {FAVORITE_SUGGESTIONS.map((s) => (
            <PressableScale
              key={s.kind}
              onPress={() => {
                setKind(s.kind);
                setLabel(s.label);
              }}
              style={[styles.chip, kind === s.kind && styles.chipOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: kind === s.kind }}
            >
              <Text style={[typeScale.small, { color: kind === s.kind ? colors.onDark : colors.inkOcean }]}>{s.label}</Text>
            </PressableScale>
          ))}
          <PressableScale
            onPress={() => {
              setKind("custom");
              setLabel("");
            }}
            style={[styles.chip, kind === "custom" && styles.chipOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: kind === "custom" }}
          >
            <Text style={[typeScale.small, { color: kind === "custom" ? colors.onDark : colors.inkOcean }]}>Something else</Text>
          </PressableScale>
        </View>
      )}
      {kind === "custom" && <Input label="What is it?" placeholder="Our coffee order" value={label} onChangeText={setLabel} maxLength={60} />}
      {kind === "song" ? (
        song ? (
          <SongCard song={song} compact onRemove={() => setSong(null)} style={styles.sheetSong} />
        ) : (
          <Button title="Pick our song" icon="musicalNotes" variant="soft" onPress={() => setPicker(true)} style={styles.sheetSong} />
        )
      ) : (
        <Input label={kind === "custom" ? "Ours is…" : `${label || "It"} is…`} placeholder={suggestion?.placeholder ?? ""} value={value} onChangeText={setValue} maxLength={200} style={styles.valueInput} />
      )}
      <Button title="Save" onPress={save} loading={busy} disabled={!canSave} style={styles.save} />
      {editing && (
        <Button
          title="Remove"
          variant="text"
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await onDelete(editing.id);
              onClose();
            } catch (err: any) {
              Alert.alert("Couldn't remove", err.message ?? String(err));
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      <SongPicker visible={picker} onClose={() => setPicker(false)} onChoose={setSong} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  song: { marginBottom: space.md },
  songLabel: { marginBottom: space.xs },
  scraps: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginTop: space.xs },
  scrap: { minWidth: 120, maxWidth: "48%", paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.photo, ...shadows.lifted },
  scrapLabel: { color: colors.inkSoft },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },
  blank: { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.paperEdge, borderRadius: radius.photo, paddingHorizontal: space.md, paddingVertical: space.xs + 2 },
  blankText: { color: colors.ocean },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginVertical: space.md },
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, backgroundColor: colors.paperDeep },
  chipOn: { backgroundColor: colors.ocean },
  sheetSong: { marginVertical: space.md },
  valueInput: { fontFamily: fonts.hand, fontSize: 22, lineHeight: 26 },
  save: { marginTop: space.md },
});
