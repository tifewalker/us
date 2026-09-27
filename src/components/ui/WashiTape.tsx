import { shadows, tape, type TapeColor } from "@/theme";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

// A translucent strip of washi tape. Position it absolutely over the top edge
// of a photo or note to "pin" it.
export function WashiTape({
  color = "sand",
  width = 64,
  rotate = -4,
  style,
}: {
  color?: TapeColor;
  width?: number;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.tape,
        { width, backgroundColor: tape[color], transform: [{ rotate: `${rotate}deg` }] },
        style,
      ]}
    >
      {/* faint stripes so it reads as paper tape, not a plain bar */}
      <View style={[styles.stripe, { left: "22%" }]} />
      <View style={[styles.stripe, { left: "55%" }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tape: {
    height: 20,
    opacity: 0.85,
    borderRadius: 1,
    overflow: "hidden",
    ...shadows.lifted,
  },
  stripe: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});
