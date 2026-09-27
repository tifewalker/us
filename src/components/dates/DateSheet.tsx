import {
    Body,
    Button,
    DatePickerField,
    Icon3D,
    Input,
    PressableScale,
    Sheet,
    Title,
    toDateString,
    type Icon3DName,
} from "@/components/ui";
import { parseLocalDate } from "@/lib/dates";
import {
    deleteImportantDate,
    saveBirthday,
    saveCustomDate,
    type ImportantDate,
} from "@/lib/importantDates";
import { colors, radius, space, type as typeScale } from "@/theme";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

const CUSTOM_ICONS: Icon3DName[] = ["calendar", "star", "heart", "gift", "palm", "film", "sparkles", "fire", "moon", "sun", "wave", "shell", "musicalNotes"];
const FAR_FUTURE = new Date(2100, 0, 1);

type Kind = "mine" | "partner" | "custom";

// Add / edit an important date: my birthday, my partner's birthday (either of
// you can set either), or a custom date with a label and a 3D icon.
export function DateSheet({
  visible,
  onClose,
  onSaved,
  coupleId,
  myId,
  partnerId,
  partnerName,
  dates,
  editing,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  coupleId: string;
  myId: string;
  partnerId: string | null;
  partnerName: string;
  dates: ImportantDate[];
  editing: ImportantDate | null; // null = new
}) {
  const [kind, setKind] = useState<Kind>("custom");
  const [date, setDate] = useState<Date | null>(null);
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState<Icon3DName>("calendar");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setKind(editing.type === "custom" ? "custom" : editing.person_id === myId ? "mine" : "partner");
      setDate(parseLocalDate(editing.date));
      setLabel(editing.label);
      setIcon((editing.emoji as Icon3DName) ?? "calendar");
    } else {
      setKind(dates.some((d) => d.type === "birthday" && d.person_id === myId) ? "custom" : "mine");
      setDate(null);
      setLabel("");
      setIcon("calendar");
    }
  }, [visible, editing, dates, myId]);

  const birthdayRow = (personId: string | null) =>
    personId ? dates.find((d) => d.type === "birthday" && d.person_id === personId) : undefined;

  async function save() {
    if (!date) {
      Alert.alert("Pick a date", "Choose the day first.");
      return;
    }
    if (kind === "custom" && !label.trim()) {
      Alert.alert("Give it a name", "What's this day?");
      return;
    }
    setSaving(true);
    try {
      const d = toDateString(date);
      if (kind === "custom") {
        await saveCustomDate(coupleId, { label: label.trim(), date: d, emoji: icon }, editing?.type === "custom" ? editing.id : undefined);
      } else {
        const personId = kind === "mine" ? myId : partnerId;
        if (!personId) throw new Error("Your partner hasn't joined yet.");
        await saveBirthday(coupleId, personId, d, birthdayRow(personId)?.id);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert("Couldn't save", err.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    setSaving(true);
    try {
      await deleteImportantDate(editing.id);
      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert("Couldn't remove it", err.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  const kinds: { value: Kind; label: string; disabled?: boolean }[] = [
    { value: "mine", label: "My birthday" },
    { value: "partner", label: `${partnerName}'s birthday`, disabled: !partnerId },
    { value: "custom", label: "Another day" },
  ];

  return (
    <Sheet visible={visible} onClose={saving ? () => {} : onClose}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Title variant="heading">{editing ? "Edit date" : "Add a date"}</Title>

        {!editing && (
          <View style={styles.chips} accessibilityRole="radiogroup">
            {kinds.map((k) => (
              <PressableScale
                key={k.value}
                onPress={() => setKind(k.value)}
                disabled={k.disabled}
                accessibilityRole="radio"
                accessibilityState={{ selected: kind === k.value, disabled: k.disabled }}
                style={[styles.chip, kind === k.value && styles.chipOn]}
              >
                <Text style={[typeScale.small, { color: kind === k.value ? colors.onDark : colors.inkOcean }]}>{k.label}</Text>
              </PressableScale>
            ))}
          </View>
        )}

        <View style={styles.field}>
          <DatePickerField
            label={kind === "custom" ? "When" : "Birthday (with the year)"}
            value={date}
            onChange={setDate}
            placeholder="Pick the day"
            maximumDate={kind === "custom" ? FAR_FUTURE : new Date()}
          />
        </View>

        {kind === "custom" && (
          <>
            <Input label="What's the day?" placeholder="Our first trip" value={label} onChangeText={setLabel} maxLength={60} />
            <Body variant="label" color={colors.inkSoft} style={styles.iconLabel}>
              Icon
            </Body>
            <View style={styles.icons}>
              {CUSTOM_ICONS.map((name) => (
                <PressableScale
                  key={name}
                  onPress={() => setIcon(name)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: icon === name }}
                  accessibilityLabel={name}
                  style={[styles.iconChoice, icon === name && styles.iconChoiceOn]}
                >
                  <Icon3D name={name} size={30} />
                </PressableScale>
              ))}
            </View>
          </>
        )}

        <Button title="Save" onPress={save} loading={saving} style={styles.save} />
        {editing && <Button title="Remove this date" variant="text" onPress={remove} disabled={saving} />}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, backgroundColor: colors.paperDeep },
  chipOn: { backgroundColor: colors.ocean },
  field: { marginTop: space.lg },
  iconLabel: { marginBottom: space.xs, marginLeft: space.xs },
  icons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  iconChoice: { padding: space.xs, borderRadius: radius.input, borderWidth: 2, borderColor: "transparent" },
  iconChoiceOn: { borderColor: colors.sky, backgroundColor: colors.warmWhite },
  save: { marginTop: space.xl },
});
