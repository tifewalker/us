import { Avatar, Body, Button, Handwritten, Input, PressableScale, Sheet, Title } from "@/components/ui";
import type { Profile } from "@/lib/profile";
import { deleteLittleThing, getLittleThings, LITTLE_THING_PROMPTS, saveLittleThing, type LittleThing } from "@/lib/us";
import { colors, fonts, radius, shadows, space, type as typeScale } from "@/theme";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SectionHeading } from "./SectionHeading";

// "Little things about me / {Name}": two notebook pages, side by side on wide
// phones and stacked on narrow ones. Mine is editable (tap a line, or a
// suggested prompt); theirs is read-only — RLS only lets the owner write.
export function LittleThings({
  coupleId,
  myId,
  partnerId,
  me,
  partner,
  partnerName,
  refreshKey,
}: {
  coupleId: string;
  myId: string;
  partnerId: string | null;
  me: Profile | null;
  partner: Profile | null;
  partnerName: string;
  refreshKey: number;
}) {
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<LittleThing[]>([]);
  const [editing, setEditing] = useState<{ label: string; value: string; id?: string } | null>(null);

  const load = () => getLittleThings(coupleId).then(setItems).catch((e) => console.log("[LittleThings]", e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, refreshKey]);

  const mine = items.filter((i) => i.user_id === myId);
  const theirs = items.filter((i) => i.user_id !== myId);
  const unanswered = LITTLE_THING_PROMPTS.filter((p) => !mine.some((m) => m.label === p));
  const sideBySide = width >= 400;

  return (
    <View>
      <SectionHeading icon="sparklingHeart" title="Little things" />
      <View style={sideBySide ? styles.row : styles.stack}>
        <View style={[styles.page, sideBySide && styles.flex, { transform: [{ rotate: "-0.8deg" }] }]}>
          <PageHeader profile={me} title="About me" />
          {mine.map((m) => (
            <PressableScale key={m.id} onPress={() => setEditing({ label: m.label, value: m.value, id: m.id })} accessibilityLabel={`${m.label}: ${m.value}. Edit`} style={styles.line}>
              <Text style={[typeScale.small, styles.label]}>{m.label}</Text>
              <Handwritten variant="handSmall">{m.value}</Handwritten>
            </PressableScale>
          ))}
          <View style={styles.prompts}>
            {unanswered.slice(0, sideBySide ? 4 : 6).map((p) => (
              <PressableScale key={p} onPress={() => setEditing({ label: p, value: "" })} accessibilityRole="button" accessibilityLabel={`Add ${p}`} style={styles.prompt}>
                <Text style={[typeScale.small, styles.promptText]}>+ {p.toLowerCase()}</Text>
              </PressableScale>
            ))}
            <PressableScale onPress={() => setEditing({ label: "", value: "" })} accessibilityRole="button" accessibilityLabel="Add your own" style={styles.prompt}>
              <Text style={[typeScale.small, styles.promptText]}>+ your own</Text>
            </PressableScale>
          </View>
        </View>

        {partnerId && (
          <View style={[styles.page, styles.pageTheirs, sideBySide && styles.flex, { transform: [{ rotate: "0.8deg" }] }]}>
            <PageHeader profile={partner} title={`About ${partnerName}`} />
            {theirs.length === 0 ? (
              <Handwritten variant="handSmall" color={colors.inkSoft}>
                {partnerName} hasn't filled this in yet.
              </Handwritten>
            ) : (
              theirs.map((t) => (
                <View key={t.id} style={styles.line}>
                  <Text style={[typeScale.small, styles.label]}>{t.label}</Text>
                  <Handwritten variant="handSmall">{t.value}</Handwritten>
                </View>
              ))
            )}
          </View>
        )}
      </View>

      <LittleThingSheet
        editing={editing}
        onClose={() => setEditing(null)}
        onSave={async (label, value) => {
          await saveLittleThing(coupleId, myId, label, value);
          // renaming a line = save the new label, remove the old one
          if (editing?.id && editing.label !== label.trim()) await deleteLittleThing(editing.id);
          await load();
        }}
        onDelete={async (id) => {
          await deleteLittleThing(id);
          await load();
        }}
      />
    </View>
  );
}

function PageHeader({ profile, title }: { profile: Profile | null; title: string }) {
  return (
    <View style={styles.header}>
      <Avatar url={profile?.avatarUrl} cacheKey={profile?.avatarPath} name={profile?.firstName} size={32} />
      <Title variant="headingItalic" style={styles.flex} numberOfLines={1}>
        {title}
      </Title>
    </View>
  );
}

function LittleThingSheet({
  editing,
  onClose,
  onSave,
  onDelete,
}: {
  editing: { label: string; value: string; id?: string } | null;
  onClose: () => void;
  onSave: (label: string, value: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (editing) {
      setLabel(editing.label);
      setValue(editing.value);
    }
  }, [editing]);
  const custom = !editing?.label || !LITTLE_THING_PROMPTS.includes(editing.label);

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
    <Sheet visible={!!editing} onClose={busy ? () => {} : onClose}>
      <Title variant="heading">{custom ? "A little thing about you" : editing?.label}</Title>
      <Body variant="small" color={colors.inkSoft} style={styles.hint}>
        Only you can change your page.
      </Body>
      {custom && <Input label="What is it?" placeholder="Coffee order" value={label} onChangeText={setLabel} maxLength={60} />}
      <Input placeholder="Write it how you'd say it…" value={value} onChangeText={setValue} maxLength={200} autoFocus={!custom} style={styles.value} />
      <Button title="Save" onPress={() => run(() => onSave(label, value))} loading={busy} disabled={!label.trim() || !value.trim()} style={styles.save} />
      {editing?.id && <Button title="Remove" variant="text" disabled={busy} onPress={() => run(() => onDelete(editing.id!))} />}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  stack: { gap: space.lg },
  flex: { flex: 1 },
  page: {
    backgroundColor: colors.warmWhite,
    borderRadius: radius.photo,
    padding: space.lg,
    borderLeftWidth: 3,
    borderLeftColor: "#F1B8AE", // notebook margin line (tapeCoral, a touch deeper)
    ...shadows.paper,
  },
  pageTheirs: { backgroundColor: colors.paper },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm },
  line: { paddingVertical: space.xs, borderBottomWidth: 1, borderBottomColor: colors.paperEdge },
  label: { color: colors.inkSoft },
  prompts: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.md },
  prompt: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.photo, borderWidth: 1, borderStyle: "dashed", borderColor: colors.paperEdge },
  promptText: { color: colors.ocean },
  hint: { marginTop: space.xs, marginBottom: space.md },
  value: { fontFamily: fonts.hand, fontSize: 22, lineHeight: 26 },
  save: { marginTop: space.md },
});
