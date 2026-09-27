import { scene } from "@/theme";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import type { BeachLayout } from "./layout";
import { useLoop } from "./useLoop";

// A periodic wave strip: `width` must cover the screen plus one wavelength so
// translating by exactly one wavelength loops seamlessly.
function wavePath(width: number, wavelength: number, amplitude: number, height: number) {
  let d = `M 0 ${amplitude}`;
  for (let x = 0; x < width; x += wavelength) {
    d += ` Q ${x + wavelength / 4} ${-amplitude * 0.2} ${x + wavelength / 2} ${amplitude}`;
    d += ` Q ${x + (wavelength * 3) / 4} ${amplitude * 2.2} ${x + wavelength} ${amplitude}`;
  }
  return d + ` L ${width} ${height} L 0 ${height} Z`;
}

function foamPath(width: number, wavelength: number, amplitude: number) {
  let d = `M 0 ${amplitude}`;
  for (let x = 0; x < width; x += wavelength) {
    d += ` Q ${x + wavelength / 4} ${-amplitude * 0.2} ${x + wavelength / 2} ${amplitude}`;
    d += ` Q ${x + (wavelength * 3) / 4} ${amplitude * 2.2} ${x + wavelength} ${amplitude}`;
  }
  return d;
}

// Layer 4: sea body + three wave layers at different speeds. The front
// (shallow) wave's crest carries the foam line that laps onto the sand.
export function Sea({ layout, active, dim, lite = false }: { layout: BeachLayout; active: boolean; dim: number; lite?: boolean }) {
  const { W, horizonY, shoreY } = layout;
  const seaHeight = shoreY - horizonY + 20;

  return (
    <View style={[styles.sea, { top: horizonY, height: seaHeight }]} pointerEvents="none">
      <Svg width={W} height={seaHeight}>
        <Defs>
          <LinearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={scene.seaDeep} />
            <Stop offset="1" stopColor={scene.sea} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={seaHeight} fill="url(#sea)" />
        {/* horizon highlight */}
        <Rect x={0} y={0} width={W} height={2} fill="#FFF8EF" opacity={0.25} />
      </Svg>

      <WaveLayer W={W} top={seaHeight * 0.2} height={seaHeight} wavelength={W / 3} amplitude={4} color={scene.sea} duration={11000} active={active && !lite} />
      <WaveLayer W={W} top={seaHeight * 0.45} height={seaHeight} wavelength={W / 2.2} amplitude={6} color={scene.seaLight} duration={8000} reverse active={active && !lite} />
      <WaveLayer W={W} top={seaHeight - 46} height={seaHeight} wavelength={W / 1.6} amplitude={7} color={scene.seaShallow} duration={6500} active={active} foam />

      {dim > 0 && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#071A2B", opacity: dim * 0.35 }]} />
      )}
    </View>
  );
}

function WaveLayer({
  W,
  top,
  height,
  wavelength,
  amplitude,
  color,
  duration,
  reverse = false,
  foam = false,
  active,
}: {
  W: number;
  top: number;
  height: number;
  wavelength: number;
  amplitude: number;
  color: string;
  duration: number;
  reverse?: boolean;
  foam?: boolean;
  active: boolean;
}) {
  const width = W + wavelength;
  const h = height - top;
  const p = useLoop(duration, active);
  const bob = useLoop(3200, active, { reverse: true });
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: reverse ? -wavelength + p.value * wavelength : -p.value * wavelength },
      { translateY: foam ? bob.value * 4 : 0 },
    ],
  }));

  return (
    <Animated.View style={[styles.wave, { top, width, height: h }, style]}>
      <Svg width={width} height={h}>
        {/* cut-paper shadow on the layer below */}
        <Path d={wavePath(width, wavelength, amplitude, h)} fill="#000" opacity={0.08} transform="translate(0 -3)" />
        <Path d={wavePath(width, wavelength, amplitude, h)} fill={color} />
        {foam && (
          <Path
            d={foamPath(width, wavelength, amplitude)}
            stroke={scene.foam}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
            opacity={0.9}
          />
        )}
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sea: { position: "absolute", left: 0, right: 0, overflow: "hidden" },
  wave: { position: "absolute", left: 0 },
});
