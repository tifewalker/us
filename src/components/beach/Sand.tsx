import { scene } from "@/theme";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import type { BeachLayout } from "./layout";

function sandTop(W: number, y: number) {
  // gentle hand-cut edge
  const s = W / 6;
  return `M 0 ${y + 4} C ${s} ${y - 6} ${s * 2} ${y + 8} ${s * 3} ${y + 2} C ${s * 4} ${y - 5} ${s * 5} ${y + 7} ${W} ${y}`;
}

// Layer 5: sand (cut-paper edge + wet band) with footprints walking up from
// the bottom of the screen toward the objects.
export function Sand({ layout, dim }: { layout: BeachLayout; dim: number }) {
  const { W, H, shoreY, groundBottom, polaroid, polaroidWidth } = layout;
  const top = shoreY - 8;
  const edge = sandTop(W, 8);
  const body = `${edge} L ${W} ${H - top} L 0 ${H - top} Z`;

  // Footprints: from bottom-centre up to just below the polaroid.
  const from = { x: W * 0.54, y: groundBottom - top + 10 };
  const to = { x: polaroid.x + 4, y: polaroid.y - top + polaroidWidth + 44 };
  const steps = 7;
  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI + 90;
  const prints = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    const side = i % 2 === 0 ? -1 : 1;
    return {
      x: from.x + (to.x - from.x) * t + side * 7,
      y: from.y + (to.y - from.y) * t,
      o: 0.55 - t * 0.3, // fade as they get further away
    };
  });

  return (
    <View style={[styles.sand, { top, height: H - top }]} pointerEvents="none">
      <Svg width={W} height={H - top}>
        <Defs>
          <LinearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={scene.sandShadow} />
            <Stop offset="0.06" stopColor={scene.sand} />
            <Stop offset="1" stopColor={scene.sandLight} />
          </LinearGradient>
        </Defs>
        {/* soft cut-paper shadow cast onto the water */}
        <Path d={body} fill="#000" opacity={0.12} transform="translate(0 -3)" />
        <Path d={body} fill="url(#sand)" />
        <Path d={edge} stroke={scene.foam} strokeWidth={3} fill="none" opacity={0.7} strokeLinecap="round" />

        {prints.map((p, i) => (
          <G key={i} transform={`translate(${p.x} ${p.y}) rotate(${angle})`} opacity={p.o}>
            <Ellipse cx={0} cy={0} rx={4} ry={7} fill={scene.footprint} />
            <Ellipse cx={0} cy={-9} rx={2.6} ry={2.2} fill={scene.footprint} />
          </G>
        ))}

        {dim > 0 && <Rect x={0} y={0} width={W} height={H - top} fill="#071A2B" opacity={dim * 0.3} />}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ sand: { position: "absolute", left: 0, right: 0 } });
