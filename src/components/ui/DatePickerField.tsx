import { colors, radius, shadows, space, type as typeScale } from "@/theme";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { Icon3D } from "./Icon3D";
import { inputStyles } from "./Input";
import { PaperTexture } from "./PaperTexture";
import { PressableScale } from "./PressableScale";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatLongDate(d: Date) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Local 'YYYY-MM-DD' (not toISOString, which shifts to UTC and can change the day).
export function toDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A trigger styled like <Input> that opens the native date picker
// (iOS: inline calendar in a paper sheet; Android: system dialog).
export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = "Pick a date",
  maximumDate = new Date(),
}: {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  maximumDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? maximumDate);
  const [webText, setWebText] = useState(value ? toDateString(value) : "");

  // Web (incl. iPhone Safari / the home-screen app): the community picker has
  // no web build, so use a native <input type="date"> — iOS shows its own
  // date wheel — styled like our Input.
  if (Platform.OS === "web") {
    const max = toDateString(maximumDate);
    return (
      <View style={styles.wrap}>
        {label ? <Text style={[typeScale.label, styles.label]}>{label}</Text> : null}
        <input
          type="date"
          aria-label={label ?? placeholder}
          value={value ? toDateString(value) : webText}
          max={max}
          onChange={(e: any) => {
            const t = String(e.target.value ?? "");
            setWebText(t);
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
            if (m) onChange(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
          }}
          style={{
            fontFamily: "Nunito_400Regular, system-ui, sans-serif",
            fontSize: 16, // ≥16px stops iOS Safari zooming into the field
            color: value ? colors.ink : colors.inkFaint,
            backgroundColor: colors.paperDeep,
            border: `1.5px solid ${colors.paperEdge}`,
            borderRadius: radius.input,
            padding: "12px 16px",
            minHeight: 52,
            width: "100%",
            boxSizing: "border-box",
            WebkitAppearance: "none",
            appearance: "none",
          }}
        />
      </View>
    );
  }

  function openPicker() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: value ?? maximumDate,
        mode: "date",
        maximumDate,
        onChange: (event, date) => {
          if (event.type === "set" && date) onChange(date);
        },
      });
      return;
    }
    setDraft(value ?? maximumDate);
    setOpen(true);
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[typeScale.label, styles.label]}>{label}</Text> : null}
      <PressableScale
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        accessibilityValue={{ text: value ? formatLongDate(value) : placeholder }}
        style={[inputStyles.field, styles.trigger]}
      >
        <Text style={[typeScale.body, { color: value ? colors.ink : colors.inkFaint, flex: 1 }]}>
          {value ? formatLongDate(value) : placeholder}
        </Text>
        <Icon3D name="calendar" size={26} />
      </PressableScale>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetClip} pointerEvents="none">
              <PaperTexture />
            </View>
            <DateTimePicker
              value={draft}
              mode="date"
              display="inline"
              maximumDate={maximumDate}
              accentColor={colors.ocean}
              themeVariant="light"
              onChange={(_, date) => date && setDraft(date)}
            />
            <View style={styles.actions}>
              <Button title="Cancel" variant="text" onPress={() => setOpen(false)} />
              <Button
                title="Done"
                onPress={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  label: { color: colors.inkSoft, marginBottom: space.xs, marginLeft: space.xs },
  trigger: { flexDirection: "row", alignItems: "center" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(7,26,43,0.45)",
    justifyContent: "center",
    padding: space.lg,
  },
  sheet: {
    backgroundColor: colors.paper,
    borderRadius: radius.ticket,
    padding: space.md,
    ...shadows.floating,
  },
  sheetClip: { ...StyleSheet.absoluteFill, borderRadius: radius.ticket, overflow: "hidden" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm, marginTop: space.sm },
});
