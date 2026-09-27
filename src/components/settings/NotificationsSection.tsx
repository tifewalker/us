import { Body, Button, Icon3D, PressableScale, Sheet, Title } from "@/components/ui";
import {
  DEFAULT_PREFS,
  disableNotifications,
  enableNotifications,
  getNotificationPrefs,
  getPushStatus,
  saveNotificationPrefs,
  sendTestNotification,
  type NotificationPrefs,
  type PushStatus,
} from "@/lib/push";
import { colors, radius, space, type as typeScale } from "@/theme";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View } from "react-native";

type CategoryKey = "partner_activity" | "bottles_gifts" | "dates" | "remember" | "nudges";

// Settings → Notifications: status + "Turn on" (from the tap, as iOS
// requires), category switches, quiet hours, and a test send.
export function NotificationsSection({ userId, partnerName }: { userId: string; partnerName: string }) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<"quiet_start" | "quiet_end" | null>(null);

  useEffect(() => {
    getPushStatus().then(setStatus);
    getNotificationPrefs(userId).then(setPrefs).catch(() => {});
  }, [userId]);

  function turnOn() {
    // no await before this call: Safari only allows the prompt inside the tap
    const pending = enableNotifications();
    setBusy(true);
    pending
      .then(setStatus)
      .catch((e) => Alert.alert("Couldn't turn on notifications", e?.message ?? String(e)))
      .finally(() => setBusy(false));
  }

  async function turnOff() {
    setBusy(true);
    try {
      await disableNotifications();
      setStatus(await getPushStatus());
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const n = await sendTestNotification("test");
      if (n === 0) Alert.alert("No device reached", "Turn notifications off and on again on this phone.");
    } catch (e: any) {
      Alert.alert("Test didn't send", e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function update(next: NotificationPrefs) {
    const before = prefs;
    setPrefs(next);
    saveNotificationPrefs(userId, next).catch((e) => {
      setPrefs(before);
      Alert.alert("Couldn't save", e?.message ?? String(e));
    });
  }

  const categories: { key: CategoryKey; label: string; hint: string }[] = [
    { key: "partner_activity", label: `From ${partnerName}`, hint: "Answers, questions, songs, memories, missions" },
    { key: "bottles_gifts", label: "Bottles & gifts", hint: "When something washes ashore" },
    { key: "dates", label: "Dates & reminders", hint: "Birthdays, our anniversary, your dates" },
    { key: "remember", label: "Remember when", hint: "An old memory, some evenings" },
    { key: "nudges", label: "Gentle nudges", hint: `At most ${prefs.daily_nudge_cap} a day, never at night` },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Icon3D name="bottle" size={36} />
        <Title variant="headingItalic" style={styles.flex}>
          Notifications
        </Title>
      </View>

      {status === null ? (
        <ActivityIndicator color={colors.coral} />
      ) : (
        <View style={styles.status}>
          {status === "native" && <Body color={colors.inkSoft}>Notifications arrive in the Us web app on your home screen — open it there to turn them on.</Body>}
          {status === "needs-install" && (
            <Body color={colors.inkSoft}>Add Us to your home screen first: in Safari tap Share → “Add to Home Screen”, then open Us from its icon and come back here.</Body>
          )}
          {status === "unsupported" && <Body color={colors.inkSoft}>This browser can't show notifications. Try the Us app on your home screen.</Body>}
          {status === "denied" && (
            <Body color={colors.inkSoft}>Notifications are blocked. On iPhone: Settings → Notifications → Us → Allow Notifications, then come back.</Body>
          )}
          {status === "default" && <Button title="Turn on notifications" icon="bottle" onPress={turnOn} loading={busy} />}
          {status === "on" && (
            <>
              <Body variant="bodyStrong" color={colors.ocean}>
                Notifications are on ✓
              </Body>
              <View style={styles.row}>
                <Button title="Send me a test" variant="soft" onPress={test} disabled={busy} style={styles.flex} />
                <Button title="Turn off here" variant="text" onPress={turnOff} disabled={busy} />
              </View>
            </>
          )}
        </View>
      )}

      {categories.map((c) => (
        // plain View (not pressable) around the Switch — see CLAUDE.md gotchas
        <View key={c.key} style={styles.toggle}>
          <View style={styles.flex}>
            <Body variant="bodyStrong">{c.label}</Body>
            <Body variant="small" color={colors.inkSoft}>
              {c.hint}
            </Body>
          </View>
          <Switch
            value={prefs[c.key]}
            onValueChange={(v) => update({ ...prefs, [c.key]: v })}
            trackColor={{ true: colors.ocean, false: colors.paperEdge }}
            thumbColor={colors.warmWhite}
            accessibilityLabel={c.label}
          />
        </View>
      ))}

      <View style={styles.quiet}>
        <Body variant="bodyStrong" style={styles.flex}>
          Quiet hours
        </Body>
        <TimeChip label="from" value={prefs.quiet_start} onPress={() => setPicking("quiet_start")} />
        <TimeChip label="to" value={prefs.quiet_end} onPress={() => setPicking("quiet_end")} />
      </View>
      <Body variant="small" color={colors.inkSoft}>
        Things from {partnerName} wait until morning; nudges are skipped.
      </Body>

      <TimeSheet
        visible={picking !== null}
        title={picking === "quiet_start" ? "Quiet from" : "Quiet until"}
        value={picking ? prefs[picking] : "00:00"}
        onClose={() => setPicking(null)}
        onChoose={(t) => {
          if (picking) update({ ...prefs, [picking]: t });
          setPicking(null);
        }}
      />
    </View>
  );
}

const hhmm = (t: string) => t.slice(0, 5);

function TimeChip({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Quiet hours ${label} ${hhmm(value)}. Change`} style={styles.chip}>
      <Text style={[typeScale.small, styles.chipText]}>
        {label} {hhmm(value)}
      </Text>
    </PressableScale>
  );
}

function TimeSheet({ visible, title, value, onClose, onChoose }: { visible: boolean; title: string; value: string; onClose: () => void; onChoose: (t: string) => void }) {
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const [h, m] = value.split(":").map(Number);
    setHour(h || 0);
    setMinute(m || 0);
  }, [visible, value]);
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Title variant="heading">{title}</Title>
      <View style={styles.grid}>
        {Array.from({ length: 24 }, (_, h) => (
          <PressableScale key={h} onPress={() => setHour(h)} style={[styles.cell, hour === h && styles.cellOn]} accessibilityRole="radio" accessibilityState={{ selected: hour === h }}>
            <Text style={[typeScale.small, { color: hour === h ? colors.onDark : colors.inkOcean }]}>{String(h).padStart(2, "0")}</Text>
          </PressableScale>
        ))}
      </View>
      <View style={styles.minutes}>
        {[0, 15, 30, 45].map((m) => (
          <PressableScale key={m} onPress={() => setMinute(m)} style={[styles.cell, styles.minuteCell, minute === m && styles.cellOn]} accessibilityRole="radio" accessibilityState={{ selected: minute === m }}>
            <Text style={[typeScale.small, { color: minute === m ? colors.onDark : colors.inkOcean }]}>:{String(m).padStart(2, "0")}</Text>
          </PressableScale>
        ))}
      </View>
      <Button title={`Set ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`} onPress={() => onChoose(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`)} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xxl, paddingHorizontal: space.sm, gap: space.sm },
  header: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
  status: { gap: space.sm, marginBottom: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  toggle: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.paperEdge },
  quiet: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md },
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, backgroundColor: colors.paperDeep },
  chipText: { color: colors.inkOcean },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginVertical: space.md },
  cell: { width: 48, height: 40, borderRadius: radius.paper, alignItems: "center", justifyContent: "center", backgroundColor: colors.paperDeep },
  cellOn: { backgroundColor: colors.ocean },
  minutes: { flexDirection: "row", gap: space.xs, marginBottom: space.lg },
  minuteCell: { flex: 1 },
});
