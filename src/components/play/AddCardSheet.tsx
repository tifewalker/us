import { Body, Button, Input, PressableScale, Sheet, Title } from "@/components/ui";
import { addCustomCard, categoryLabel, type CardTable } from "@/lib/play";
import { colors, radius, space, type as typeScale } from "@/theme";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

// "Add your own card" for any Play game. Spicy is offered only when spicy
// mode is on (the database refuses it otherwise anyway).
export function AddCardSheet({
  visible,
  onClose,
  onAdded,
  table,
  categories,
  spicyOn,
  coupleId,
  myId,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
  table: CardTable;
  categories: readonly string[];
  spicyOn: boolean;
  coupleId: string;
  myId: string;
  title: string;
}) {
  const options = spicyOn ? [...categories, "spicy"] : [...categories];
  const [text, setText] = useState("");
  const [category, setCategory] = useState(options[0]);
  const [duration, setDuration] = useState("today");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setText("");
      setCategory(options[0]);
      setDuration("today");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await addCustomCard(table, { coupleId, myId, text: text.trim(), category, duration });
      onAdded();
      onClose();
    } catch (e: any) {
      Alert.alert("Couldn't add the card", e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={saving ? () => {} : onClose}>
      <Title variant="heading">{title}</Title>
      <Body variant="small" color={colors.inkSoft} style={styles.hint}>
        Only the two of you will ever see it.
      </Body>
      <Input placeholder="Write your card…" value={text} onChangeText={setText} multiline maxLength={300} autoFocus />
      <View style={styles.chips}>
        {options.map((c) => (
          <PressableScale key={c} onPress={() => setCategory(c)} accessibilityRole="radio" accessibilityState={{ selected: category === c }} style={[styles.chip, category === c && styles.chipOn]}>
            <Text style={[typeScale.small, { color: category === c ? colors.onDark : colors.inkOcean }]}>{categoryLabel(c)}</Text>
          </PressableScale>
        ))}
      </View>
      {table === "mission_templates" && (
        <View style={styles.chips}>
          {(["quick", "today", "weekend"] as const).map((d) => (
            <PressableScale key={d} onPress={() => setDuration(d)} style={[styles.chip, duration === d && styles.chipOn]}>
              <Text style={[typeScale.small, { color: duration === d ? colors.onDark : colors.inkOcean }]}>{categoryLabel(d)}</Text>
            </PressableScale>
          ))}
        </View>
      )}
      <Button title="Add card" onPress={save} loading={saving} disabled={!text.trim()} style={styles.save} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: { marginTop: space.xs, marginBottom: space.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, backgroundColor: colors.paperDeep },
  chipOn: { backgroundColor: colors.ocean },
  save: { marginTop: space.lg },
});
