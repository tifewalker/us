import { scene } from "@/theme";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import type { BeachLayout } from "./layout";
import { useLoop } from "./useLoop";

// Puffy cut-paper cloud, drawn in a 120×50 box.
const CLOUD = "M14 42 C2 42 2 26 14 26 C14 12 34 8 42 18 C48 4 74 4 80 20 C96 14 110 24 104 36 C112 40 108 46 100 46 L18 46 C14 46 12 44 14 42 Z";

const CLOUDS = [
  { y: 0.2, scale: 1.0, duration: 140000, start: 0.15 },
  { y: 0.42, scale: 0.7, duration: 190000, start: 0.6 },
  { y: 0.62, scale: 0.85, duration: 165000, start: 0.85 },
];

// Layer 3: 2–3 clouds drifting left→right at different speeds.
export function Clouds({ layout, active, dim }: { layout: BeachLayout; active: boolean; dim: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {CLOUDS.map((c, i) => (
        <Cloud key={i} layout={layout} {...c} active={active} dim={dim} />
      ))}
    </View>
  );
}

function Cloud({
  layout,
  y,
  scale,
  duration,
  start,
  active,
  dim,
}: {
  layout: BeachLayout;
  y: number;
  scale: number;
  duration: number;
  start: number;
  active: boolean;
  dim: number;
}) {
  const { W, horizonY, insets } = layout;
  const w = 120 * scale;
  const h = 50 * scale;
  const top = insets.top + 40 + y * (horizonY - insets.top - 80);
  const p = useLoop(duration, active, { initial: start });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -w + p.value * (W + w * 2) }],
  }));

  return (
    <Animated.View style={[styles.cloud, { top, width: w, height: h + 4, opacity: 0.95 - dim * 0.55 }, style]}>
      <Svg width={w} height={h + 4} viewBox="0 0 120 54">
        <Path d={CLOUD} fill="#000" opacity={0.08} transform="translate(2 4)" />
        <Path d={CLOUD} fill={scene.cloud} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ cloud: { position: "absolute", left: 0 } });
