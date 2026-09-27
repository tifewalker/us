import { scene } from "@/theme";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { seededUnit } from "@/components/ui/seeded";
import type { BeachLayout } from "./layout";
import { celestial, nightFactor, skyAt } from "./time";
import { useLoop } from "./useLoop";

const STAR_GROUPS = 3;
const STARS_PER_GROUP = 7;

// Layer 1–2: time-of-day sky gradient, sun or moon on its arc, twinkling stars.
// `sunset` (anniversary mode): a fixed palette all day and a big low sun
// resting near the horizon — no stars, no moon.
export function Sky({
  layout,
  hour,
  active,
  sunset,
}: {
  layout: BeachLayout;
  hour: number;
  active: boolean;
  sunset?: { colors: readonly [string, string, string]; sunT: number };
}) {
  const { W, shoreY, horizonY, insets } = layout;
  const [top, mid, bottom] = sunset ? sunset.colors : skyAt(hour);
  const night = sunset ? 0 : nightFactor(hour);
  const { body, t } = sunset ? { body: "sun" as const, t: sunset.sunT } : celestial(hour);

  // Arc from the left horizon, up to near the top safe area, down to the right.
  const r = sunset ? 34 : body === "sun" ? 26 : 20;
  const arcTop = insets.top + 70;
  const cx = W * (0.08 + 0.84 * t);
  const cy = horizonY - Math.sin(Math.PI * t) * (horizonY - arcTop) + r * 0.4;

  return (
    <View style={[StyleSheet.absoluteFill, { height: shoreY }]} pointerEvents="none">
      <Svg width={W} height={shoreY}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={top} />
            <Stop offset="0.55" stopColor={mid} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={shoreY} fill="url(#sky)" />

        {/* sun / moon: flat paper disc with a soft offset shadow */}
        <Circle cx={cx + 2} cy={cy + 3} r={r} fill="#000" opacity={0.1} />
        {body === "sun" ? (
          <>
            <Circle cx={cx} cy={cy} r={r + (sunset ? 22 : 10)} fill={scene.sun} opacity={sunset ? 0.3 : 0.25} />
            <Circle cx={cx} cy={cy} r={r} fill={sunset ? "#FFC47A" : scene.sun} />
          </>
        ) : (
          <Path
            // crescent: full disc minus an offset disc
            d={`M ${cx} ${cy - r} a ${r} ${r} 0 1 0 0.01 0 Z M ${cx + r * 0.45} ${cy - r * 0.95} a ${r * 0.9} ${r * 0.9} 0 1 1 -0.01 0 Z`}
            fill={scene.moon}
            fillRule="evenodd"
          />
        )}
      </Svg>

      {night > 0.05 &&
        Array.from({ length: STAR_GROUPS }, (_, g) => (
          <StarGroup key={g} group={g} layout={layout} opacity={night} active={active} />
        ))}
    </View>
  );
}

function StarGroup({
  group,
  layout,
  opacity,
  active,
}: {
  group: number;
  layout: BeachLayout;
  opacity: number;
  active: boolean;
}) {
  const { W, horizonY, insets } = layout;
  // Each group twinkles on its own slow rhythm (UI thread).
  const p = useLoop(1800 + group * 700, active, { reverse: true, delay: group * 400 });
  const style = useAnimatedStyle(() => ({ opacity: opacity * (0.45 + 0.55 * p.value) }));

  const stars = Array.from({ length: STARS_PER_GROUP }, (_, i) => {
    const seed = `star-${group}-${i}`;
    return {
      x: seededUnit(seed, 1) * W,
      y: insets.top + seededUnit(seed, 2) * (horizonY - insets.top - 20),
      r: 0.8 + seededUnit(seed, 3) * 1.4,
    };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width={W} height={horizonY}>
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={scene.moon} />
        ))}
      </Svg>
    </Animated.View>
  );
}
