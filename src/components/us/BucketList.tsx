import { SparkleBurst } from "@/components/moments/effects";
import { Body, Button, DatePickerField, formatLongDate, Handwritten, Input, PressableScale, Sheet, successHaptic, Title, toDateString } from "@/components/ui";
import { localDateString, parseLocalDate } from "@/lib/dates";
import { addBucketItem, BUCKET_EMOJI, deleteBucketItem, getBucketList, setBucketDone, updateBucketItem, type BucketItem } from "@/lib/us";
import { colors, radius, shadows, space, type as typeScale } from "@/theme";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { SectionHeading } from "./SectionHeading";

// Bucket list: a lined checklist page. Tick → sparkle + "Turn this into a
// memory?" (memory/create prefilled; the new memory is linked back). Done
// items move to "We did it" with the date. Long-press a line to edit.
export function BucketList({ coupleId, myId, refreshKey }: { coupleId: string; myId: string; refreshKey: number }) {
  const [items, setItems] = useState<BucketItem[]>([]);
  const [sheet, setSheet] = useState<{ open: boolean; editing: BucketItem | null }>({ open: false, editing: null });
  const [sparkleFor, setSparkleFor] = useState<string | null>(null);
  const [offer, setOffer] = useState<BucketItem | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const load = () => getBucketList(coupleId).then(setItems).catch((e) => console.log("[Bucket]", e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, refreshKey]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const open = items.filter((i) => !i.done_at);
  const done = items.filter((i) => i.done_at).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));

  async function tick(item: BucketItem) {
    try {
      setSparkleFor(item.id);
      successHaptic();
      await setBucketDone(item.id, myId, true);
      timers.current.push(
        setTimeout(() => {
          setSparkleFor(null);
          load();
          if (!item.memory_id) setOffer(item);
        }, 900),
      );
    } catch (err: any) {
      setSparkleFor(null);
      Alert.alert("Couldn't tick it", err.message ?? String(err));
    }
  }

  async function untick(item: BucketItem) {
    try {
      await setBucketDone(item.id, myId, false);
      await load();
    } catch (err: any) {
      Alert.alert("Couldn't change it", err.message ?? String(err));
    }
  }

  return (
    <View>
      <SectionHeading icon="palm" title="Bucket list" action="Add" onAction={() => setSheet({ open: true, editing: null })} />
      <View style={styles.page}>
        {open.length === 0 && (
          <Handwritten variant="handSmall" color={colors.inkSoft} style={styles.empty}>
            {done.length ? "All done — what's next?" : "Somewhere to go, something to try…"}
          </Handwritten>
        )}
        {open.map((item) => (
          <View key={item.id} style={styles.line}>
            <PressableScale onPress={() => tick(item)} accessibilityRole="checkbox" accessibilityState={{ checked: false }} accessibilityLabel={`Tick off ${item.title}`} hitSlop={8} style={styles.box}>
              <View />
            </PressableScale>
            <PressableScale onLongPress={() => setSheet({ open: true, editing: item })} onPress={() => setSheet({ open: true, editing: item })} style={styles.flex} accessibilityLabel={`${item.title}. Edit`}>
              <Body>
                {item.emoji ? `${item.emoji}  ` : ""}
                {item.title}
              </Body>
              {item.target_date && (
                <Body variant="small" color={colors.inkSoft}>
                  by {formatLongDate(parseLocalDate(item.target_date))}
                </Body>
              )}
            </PressableScale>
            {sparkleFor === item.id && <SparkleBurst x={22} y={22} seed={item.id} />}
          </View>
        ))}
      </View>

      {done.length > 0 && (
        <View style={styles.didIt}>
          <Title variant="headingItalic" color={colors.coral}>
            We did it
          </Title>
          {done.map((item) => (
            <PressableScale
              key={item.id}
              onPress={() => (item.memory_id ? router.push(`/memory/${item.memory_id}`) : setOffer(item))}
              onLongPress={() => untick(item)}
              accessibilityLabel={`${item.title}, done. ${item.memory_id ? "Open the memory" : "Make it a memory"}. Long-press to untick`}
              style={styles.doneLine}
            >
              <Svg width={20} height={20} viewBox="0 0 20 20">
                <Path d="M3 11 L8 16 L17 4" stroke={colors.ocean} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <View style={styles.flex}>
                <Text style={[typeScale.body, styles.doneTitle]}>
                  {item.emoji ? `${item.emoji}  ` : ""}
                  {item.title}
                </Text>
                <Body variant="small" color={colors.inkSoft}>
                  {formatLongDate(new Date(item.done_at!))}
                  {item.memory_id ? " · 📷 in our story" : ""}
                </Body>
              </View>
            </PressableScale>
          ))}
        </View>
      )}

      <BucketSheet
        visible={sheet.open}
        editing={sheet.editing}
        onClose={() => setSheet({ open: false, editing: null })}
        onSave={async (f) => {
          if (sheet.editing) await updateBucketItem(sheet.editing.id, f);
          else await addBucketItem({ coupleId, myId, ...f });
          await load();
        }}
        onDelete={async (id) => {
          await deleteBucketItem(id);
          await load();
        }}
      />

      <Sheet visible={!!offer} onClose={() => setOffer(null)}>
        <Title variant="heading">Turn this into a memory?</Title>
        <Body color={colors.inkSoft} style={styles.offerText}>
          “{offer?.title}” — add the photos while it's fresh.
        </Body>
        <Button
          title="Make it a memory"
          icon="camera"
          onPress={() => {
            const item = offer!;
            setOffer(null);
            setTimeout(
              () => router.push({ pathname: "/memory/create", params: { title: item.title, date: localDateString(), bucketItemId: item.id } }),
              350,
            );
          }}
        />
        <Button title="Not now" variant="text" onPress={() => setOffer(null)} />
      </Sheet>
    </View>
  );
}

function BucketSheet({
  visible,
  editing,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  editing: BucketItem | null;
  onClose: () => void;
  onSave: (f: { title: string; emoji: string | null; targetDate: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setTitle(editing?.title ?? "");
    setEmoji(editing?.emoji ?? null);
    setDate(editing?.target_date ? parseLocalDate(editing.target_date) : null);
  }, [visible, editing]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      onClose();
    } catch (err: any) {
      Alert.alert("Couldn't save", err.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={busy ? () => {} : onClose}>
      <Title variant="heading">{editing ? "Edit" : "Someday, together…"}</Title>
      <Input placeholder="See the northern lights" value={title} onChangeText={setTitle} maxLength={120} style={styles.titleInput} />
      <View style={styles.emojis}>
        {BUCKET_EMOJI.map((e) => (
          <PressableScale
            key={e}
            onPress={() => setEmoji(emoji === e ? null : e)}
            accessibilityRole="radio"
            accessibilityState={{ selected: emoji === e }}
            accessibilityLabel={e}
            style={[styles.emoji, emoji === e && styles.emojiOn]}
          >
            <Text style={styles.emojiText}>{e}</Text>
          </PressableScale>
        ))}
      </View>
      <DatePickerField value={date} onChange={setDate} placeholder="By when? (optional)" />
      {date && <Button title="No date" variant="text" onPress={() => setDate(null)} />}
      <Button
        title={editing ? "Save" : "Add to our list"}
        onPress={() => run(() => onSave({ title, emoji, targetDate: date ? toDateString(date) : null }))}
        loading={busy}
        disabled={!title.trim()}
        style={styles.save}
      />
      {editing && <Button title="Remove from the list" variant="text" disabled={busy} onPress={() => run(() => onDelete(editing.id))} />}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { backgroundColor: colors.warmWhite, borderRadius: radius.paper, paddingHorizontal: space.lg, paddingVertical: space.sm, transform: [{ rotate: "-0.4deg" }], ...shadows.paper },
  empty: { paddingVertical: space.md },
  line: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.paperEdge },
  box: { width: 24, height: 24, borderRadius: 5, borderWidth: 2, borderColor: colors.ocean, backgroundColor: colors.paper },
  didIt: { marginTop: space.xl, gap: space.xs },
  doneLine: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  doneTitle: { color: colors.inkSoft, textDecorationLine: "line-through" },
  offerText: { marginTop: space.xs, marginBottom: space.lg },
  titleInput: { marginTop: space.md },
  emojis: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginVertical: space.md },
  emoji: { width: 42, height: 42, borderRadius: radius.paper, alignItems: "center", justifyContent: "center", backgroundColor: colors.paperDeep },
  emojiOn: { backgroundColor: colors.sand, borderWidth: 2, borderColor: colors.sunset },
  emojiText: { fontSize: 22 },
  save: { marginTop: space.md },
});
