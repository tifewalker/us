import { scene } from "@/theme";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { G, Path } from "react-native-svg";
import { useLoop } from "./useLoop";

// Drawn in a 100×200 box; the trunk base sits at (50, 200).
const TRUNK = "M46 200 C44 160 40 120 44 80 C47 60 54 45 58 34 L64 36 C60 48 54 64 52 82 C49 120 54 160 56 200 Z";
const FRONDS = [
  "M60 34 C40 20 18 22 2 38 C20 30 40 32 60 38 Z",
  "M60 34 C48 10 26 2 10 6 C28 12 44 22 58 38 Z",
  "M60 34 C66 10 84 0 98 6 C82 12 70 24 62 38 Z",
  "M60 34 C80 22 96 30 100 48 C88 36 74 34 62 38 Z",
  "M60 34 C56 20 60 4 72 0 C66 12 64 24 62 36 Z",
];

// Layer 6: a palm that sways slightly around its base. `children` are pinned
// to the trunk (they sway with it) — e.g. the Today's-moment note.
export function Palm({
  x,
  baseY,
  height,
  active,
  delay = 0,
  flip = false,
  children,
}: {
  x: number;
  baseY: number;
  height: number;
  active: boolean;
  delay?: number;
  flip?: boolean;
  children?: ReactNode;
}) {
  const width = height / 2;
  const sway = useLoop(4200, active, { reverse: true, delay });
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(sway.value - 0.5) * 3}deg` }],
  }));

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.palm,
        { left: x - width / 2, top: baseY - height, width, height, transformOrigin: "50% 100%" },
        style,
      ]}
    >
      <Svg width={width} height={height} viewBox="0 0 100 200" style={flip && styles.flip}>
        <G transform="translate(2 3)" opacity={0.12}>
          <Path d={TRUNK} fill="#000" />
          {FRONDS.map((d, i) => (
            <Path key={i} d={d} fill="#000" />
          ))}
        </G>
        <Path d={TRUNK} fill={scene.palmTrunk} />
        {/* trunk rings */}
        {[60, 90, 120, 150, 180].map((y) => (
          <Path key={y} d={`M${45 + (y - 60) * 0.02} ${y} q6 3 11 0`} stroke={scene.palmTrunkDark} strokeWidth={2} fill="none" opacity={0.6} />
        ))}
        {FRONDS.map((d, i) => (
          <Path key={i} d={d} fill={i % 2 ? scene.palmLeafDark : scene.palmLeaf} />
        ))}
      </Svg>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  palm: { position: "absolute" },
  flip: { transform: [{ scaleX: -1 }] },
});
