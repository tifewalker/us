import { Body, selectionHaptic } from "@/components/ui";
import { setMySpicy, type SpicyState } from "@/lib/play";
import { colors, radius, space } from "@/theme";
import { useState } from "react";
import { Alert, StyleSheet, Switch, View } from "react-native";

// "Spicy mode 🌶️" — on only when BOTH of you turn it on. Turning it on sends
// nothing to your partner; they just see a small line here. Either of you
// turning it off switches it off for both.
export function SpicyToggle({
  coupleId,
  myId,
  partnerName,
  state,
  onChanged,
}: {
  coupleId: string;
  myId: string;
  partnerName: string;
  state: SpicyState;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle(on: boolean) {
    setBusy(true);
    selectionHaptic();
    try {
      await setMySpicy(coupleId, myId, on);
      onChanged();
    } catch (e: any) {
      Alert.alert("Couldn't change spicy mode", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const line = state.on
    ? "Spicy mode is on"
    : state.mine
      ? `Waiting for ${partnerName} to turn it on`
      : state.partner
        ? `${partnerName} turned on spicy mode 🌶️`
        : "Turn on (your partner has to turn it on too)";

  return (
    // A plain row: only the Switch toggles (a pressable row + Switch double-fires on web).
    <View style={[styles.row, state.on && styles.rowOn]}>
      <Body variant="bodyStrong" color={colors.inkOcean}>
        🌶️
      </Body>
      <View style={styles.flex}>
        <Body variant="label" color={colors.inkOcean}>
          Spicy mode
        </Body>
        <Body variant="small" color={colors.inkSoft}>
          {line}
        </Body>
      </View>
      <Switch
        value={state.mine}
        onValueChange={toggle}
        disabled={busy}
        trackColor={{ true: colors.sunset, false: colors.paperEdge }}
        thumbColor={colors.warmWhite}
        accessibilityLabel={`Spicy mode. ${line}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.warmWhite,
    borderRadius: radius.paper,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  rowOn: { backgroundColor: "#FFE3D8" },
  flex: { flex: 1 },
});
