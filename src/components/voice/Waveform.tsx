import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

// A row of rounded bars (0..1 heights). Bars left of `progress` (0..1) are
// drawn in `playedColor`, like the needle has passed them.
export function Waveform({
  values,
  progress = 0,
  color,
  playedColor,
  height = 32,
  style,
}: {
  values: number[];
  progress?: number;
  color: string;
  playedColor: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const n = values.length;
  return (
    <View style={[styles.row, { height }, style]} pointerEvents="none">
      {values.map((v, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {
              height: Math.max(3, v * height),
              backgroundColor: n > 0 && (i + 0.5) / n <= progress ? playedColor : color,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 2, flex: 1 },
  bar: { flex: 1, borderRadius: 2, minWidth: 2 },
});
