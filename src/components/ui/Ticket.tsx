import { colors, radius, shadows, space } from "@/theme";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { PaperTexture } from "./PaperTexture";

const NOTCH = 12;

// A paper ticket stub for codes and one-off tokens: notched sides + a dashed
// perforation between `children` (main) and `stub` (the tear-off part).
export function Ticket({
  children,
  stub,
  pageColor = colors.paper, // color behind the ticket, used to "cut" the notches
  style,
}: {
  children: ReactNode;
  stub?: ReactNode;
  pageColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.ticket, style]}>
      <View style={styles.clip} pointerEvents="none">
        <PaperTexture opacity={0.8} />
      </View>
      <View style={styles.main}>{children}</View>
      {stub ? (
        <>
          <View style={styles.perforationRow}>
            <View style={[styles.notch, styles.notchLeft, { backgroundColor: pageColor }]} />
            <View style={styles.perforation} />
            <View style={[styles.notch, styles.notchRight, { backgroundColor: pageColor }]} />
          </View>
          <View style={styles.stub}>{stub}</View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    backgroundColor: colors.warmWhite,
    borderRadius: radius.ticket,
    ...shadows.paper,
  },
  clip: { ...StyleSheet.absoluteFill, borderRadius: radius.ticket, overflow: "hidden" },
  main: { padding: space.xl, alignItems: "center" },
  perforationRow: { height: NOTCH * 2, justifyContent: "center" },
  perforation: {
    marginHorizontal: NOTCH + space.sm,
    borderTopWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.paperEdge,
  },
  notch: {
    position: "absolute",
    width: NOTCH * 2,
    height: NOTCH * 2,
    borderRadius: NOTCH,
  },
  notchLeft: { left: -NOTCH },
  notchRight: { right: -NOTCH },
  stub: { paddingHorizontal: space.xl, paddingBottom: space.lg, paddingTop: space.xs, alignItems: "center" },
});
