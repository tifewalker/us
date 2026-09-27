import { Body, Button, Handwritten, WashiTape } from "@/components/ui";
import { dismissPushOffer, enableNotifications, shouldOfferPush } from "@/lib/push";
import { colors, radius, shadows, space } from "@/theme";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

// The one-time gentle card after your first sent bottle or answered moment:
// "Want to know when {Name} replies?". Only in the installed web app, only
// while notifications are still undecided, and never again once answered.
export function NotifyPromptCard({ partnerName, style }: { partnerName: string; style?: StyleProp<ViewStyle> }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    shouldOfferPush().then(setShow);
  }, []);

  if (!show) return null;

  function yes() {
    const pending = enableNotifications(); // straight from the tap (iOS)
    setBusy(true);
    pending
      .then(() => setShow(false))
      .catch((e) => Alert.alert("Couldn't turn on notifications", e?.message ?? String(e)))
      .finally(() => setBusy(false));
  }

  return (
    <View style={[styles.card, style]}>
      <WashiTape color="mint" rotate={-5} style={styles.tape} />
      <Handwritten>Want to know when {partnerName} replies?</Handwritten>
      <Body variant="small" color={colors.inkSoft} style={styles.hint}>
        A little note on your phone — never what they wrote, just that something's waiting.
      </Body>
      <View style={styles.row}>
        <Button
          title="Not now"
          variant="text"
          onPress={() => {
            dismissPushOffer();
            setShow(false);
          }}
        />
        <Button title="Yes, tell me" onPress={yes} loading={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.warmWhite, borderRadius: radius.paper, padding: space.lg, transform: [{ rotate: "0.8deg" }], ...shadows.paper },
  tape: { position: "absolute", top: -10, left: space.xl },
  hint: { marginTop: space.xs },
  row: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm, marginTop: space.md },
});
