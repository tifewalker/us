import { colors, radius, shadows, space, type as typeScale } from "@/theme";
import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "./Button";
import { Icon3D, type Icon3DName } from "./Icon3D";
import { PaperTexture } from "./PaperTexture";
import { PressableScale } from "./PressableScale";
import { Body, Title } from "./Text";

// A paper sheet that slides up from the bottom. Tap outside to dismiss.
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button">
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]} onPress={() => {}}>
          <View style={styles.clip} pointerEvents="none">
            <PaperTexture />
          </View>
          <View style={styles.grip} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export type SheetAction = { label: string; icon?: Icon3DName; destructive?: boolean; onPress: () => void };

// A short list of actions (the "…" menu).
export function ActionSheet({
  visible,
  onClose,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  actions: SheetAction[];
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      {actions.map((a) => (
        <PressableScale
          key={a.label}
          onPress={() => {
            onClose();
            // iOS can't present a new modal while this one is still sliding
            // away (e.g. menu → delete confirmation), so run the action after.
            setTimeout(a.onPress, 350);
          }}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          style={styles.action}
        >
          {a.icon ? <Icon3D name={a.icon} size={28} /> : null}
          <Text style={[typeScale.bodyStrong, { color: a.destructive ? colors.danger : colors.inkOcean }]}>{a.label}</Text>
        </PressableScale>
      ))}
    </Sheet>
  );
}

// "Are you sure?" — a question, a consequence line, and two choices.
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={busy ? () => {} : onCancel}>
      <Title variant="heading">{title}</Title>
      <Body color={colors.inkSoft} style={styles.message}>
        {message}
      </Body>
      <View style={styles.confirmRow}>
        <Button title={cancelLabel} variant="soft" onPress={onCancel} disabled={busy} style={styles.flex} />
        <Button title={confirmLabel} onPress={onConfirm} loading={busy} style={[styles.flex, styles.danger]} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(7,26,43,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.ticket,
    borderTopRightRadius: radius.ticket,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    ...shadows.floating,
  },
  clip: { ...StyleSheet.absoluteFill, borderTopLeftRadius: radius.ticket, borderTopRightRadius: radius.ticket, overflow: "hidden" },
  grip: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.paperEdge,
    marginBottom: space.lg,
  },
  action: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
  message: { marginTop: space.sm },
  confirmRow: { flexDirection: "row", gap: space.md, marginTop: space.xl },
  flex: { flex: 1 },
  danger: { backgroundColor: colors.danger },
});
