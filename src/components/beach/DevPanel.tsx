import { Body, Button, PressableScale, Title } from "@/components/ui";
import { colors, radius, shadows, space, type as typeScale } from "@/theme";
import { DEV_NOTIFICATION_KINDS, sendTestNotification } from "@/lib/push";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ChapterNumber } from "./chapters";
import type { TimeOverride } from "./time";

export type DevOverrides = {
  time: TimeOverride;
  chapter: "auto" | ChapterNumber;
  birthday: "auto" | "me" | "partner" | "off"; // birthday mode visuals only
  everything: boolean; // "Show every object" — all conditional objects at once (layout review)
  anniversary: boolean; // "Force anniversary mode" (visuals + the moment)
  extraStones: number; // "Add a year stone" — visual only, never saved
};
const BIRTHDAY_OPTIONS: { value: DevOverrides["birthday"]; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "me", label: "Me" },
  { value: "partner", label: "Partner" },
  { value: "off", label: "Off" },
];

const TIMES: { value: TimeOverride; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "dawn", label: "Dawn" },
  { value: "day", label: "Day" },
  { value: "goldenHour", label: "Golden" },
  { value: "dusk", label: "Dusk" },
  { value: "night", label: "Night" },
];
const CHAPTER_OPTIONS: ("auto" | ChapterNumber)[] = ["auto", 1, 2, 3, 4];

// __DEV__ only (opened by long-pressing the sign). Never rendered in production.
export function DevPanel({
  visible,
  value,
  onChange,
  onReplayUnlock,
  onReplayBeginning,
  onReplayReveal,
  onReplayDevelop,
  onSealTestGift,
  onForceRemember,
  onShareRemember,
  onForceAnniversary,
  onPreviewRecap,
  onClose,
}: {
  visible: boolean;
  value: DevOverrides;
  onChange: (v: DevOverrides) => void;
  onReplayUnlock: () => void;
  onReplayBeginning: () => void;
  onReplayReveal: () => void; // today's activity, ignoring "already seen"
  onReplayDevelop: () => void;
  onSealTestGift: () => void; // a birthday gift to my partner that unlocks in 1 minute
  onForceRemember: () => void; // show a "Remember when…" today even if it isn't a remember day (phone-only)
  onShareRemember: () => void; // real pick-and-save for today (shared with the other phone)
  onForceAnniversary: () => void; // anniversary visuals + replay the moment
  onPreviewRecap: () => void; // "Our year" for the last 12 months, today's data
  onClose: () => void;
}) {
  if (!__DEV__) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={() => {}}>
          <Title variant="heading">Beach dev panel</Title>
          <Body variant="small" color={colors.inkSoft}>
            Dev builds only. Not saved.
          </Body>

          <Text style={[typeScale.label, styles.section]}>Time of day</Text>
          <View style={styles.row}>
            {TIMES.map((t) => (
              <Chip key={t.value} label={t.label} selected={value.time === t.value} onPress={() => onChange({ ...value, time: t.value })} />
            ))}
          </View>

          <Text style={[typeScale.label, styles.section]}>Chapter</Text>
          <View style={styles.row}>
            {CHAPTER_OPTIONS.map((c) => (
              <Chip
                key={String(c)}
                label={c === "auto" ? "Auto" : String(c)}
                selected={value.chapter === c}
                onPress={() => onChange({ ...value, chapter: c })}
              />
            ))}
          </View>

          <Text style={[typeScale.label, styles.section]}>Layout review</Text>
          <View style={styles.row}>
            <Chip
              label={value.everything ? "Show every object: on" : "Show every object"}
              selected={value.everything}
              onPress={() => onChange({ ...value, everything: !value.everything })}
            />
          </View>

          <Text style={[typeScale.label, styles.section]}>Birthday mode (visual only)</Text>
          <View style={styles.row}>
            {BIRTHDAY_OPTIONS.map((b) => (
              <Chip key={b.value} label={b.label} selected={value.birthday === b.value} onPress={() => onChange({ ...value, birthday: b.value })} />
            ))}
          </View>

          <Text style={[typeScale.label, styles.section]}>Replay a moment</Text>
          <View style={styles.row}>
            <Chip label="Chapter unlock" selected={false} onPress={onReplayUnlock} />
            <Chip label="Beginning" selected={false} onPress={onReplayBeginning} />
            <Chip label="Reveal (today)" selected={false} onPress={onReplayReveal} />
            <Chip label="Polaroid develop" selected={false} onPress={onReplayDevelop} />
            <Chip label="Seal a test gift (1 min)" selected={false} onPress={onSealTestGift} />
            <Chip label="Force a Remember when today (this phone)" selected={false} onPress={onForceRemember} />
            <Chip label="Pick today's Remember when for real (shared)" selected={false} onPress={onShareRemember} />
          </View>

          <Text style={[typeScale.label, styles.section]}>Anniversary</Text>
          <View style={styles.row}>
            <Chip label="Force anniversary mode" selected={value.anniversary} onPress={onForceAnniversary} />
            <Chip label="Preview recap (last 12 months)" selected={false} onPress={onPreviewRecap} />
            <Chip label={`Add a year stone (visual)${value.extraStones ? ` +${value.extraStones}` : ""}`} selected={value.extraStones > 0} onPress={() => onChange({ ...value, extraStones: value.extraStones + 1 })} />
          </View>

          <Text style={[typeScale.label, styles.section]}>Notify me now (web app, this account only)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {DEV_NOTIFICATION_KINDS.map((kind) => (
              <Chip
                key={kind}
                label={kind.replace(/_/g, " ")}
                selected={false}
                onPress={() =>
                  sendTestNotification(kind)
                    .then((n) => n === 0 && Alert.alert("No device", "Turn notifications on in Settings (installed web app) first."))
                    .catch((e) => Alert.alert("Didn't send", e?.message ?? String(e)))
                }
              />
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <Button title="Done" onPress={onClose} style={styles.done} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[typeScale.small, { color: selected ? colors.onDark : colors.inkOcean }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(7,26,43,0.4)", justifyContent: "flex-end", padding: space.lg },
  panel: { backgroundColor: colors.paper, borderRadius: radius.ticket, padding: space.xl, marginBottom: space.xxl, ...shadows.floating },
  section: { color: colors.inkSoft, marginTop: space.lg, marginBottom: space.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.paperDeep,
  },
  chipSelected: { backgroundColor: colors.ocean },
  actions: { flexDirection: "row", justifyContent: "flex-end", marginTop: space.xl, gap: space.md },
  done: { minWidth: 120 },
});
