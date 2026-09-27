import { scene } from "@/theme";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { useLoop } from "./useLoop";

const shadow = { fill: "#000", opacity: 0.12 } as const;

// Fan-shaped scallop shell, 24×22 box.
export function ShellShape({ color, size = 24 }: { color: string; size?: number }) {
  const d = "M12 21 C4 18 1 11 3 6 C6 1 18 1 21 6 C23 11 20 18 12 21 Z";
  return (
    <Svg width={size} height={size * 0.92} viewBox="0 0 24 22">
      <Path d={d} {...shadow} transform="translate(1 1.5)" />
      <Path d={d} fill={color} />
      {[-6, -3, 0, 3, 6].map((dx) => (
        <Path key={dx} d={`M12 20 L${12 + dx * 1.3} 3`} stroke="#000" strokeOpacity={0.12} strokeWidth={1} />
      ))}
    </Svg>
  );
}

export function Starfish({ x, y, size = 30 }: { x: number; y: number; size?: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 14 : 6;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${15 + r * Math.cos(a)},${15 + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <View pointerEvents="none" style={[styles.abs, { left: x - size / 2, top: y - size / 2, transform: [{ rotate: "14deg" }] }]}>
      <Svg width={size} height={size} viewBox="0 0 30 30">
        <Path d={`M${pts}Z`} {...shadow} transform="translate(1 1.5)" />
        <Path d={`M${pts}Z`} fill={scene.starfish} strokeLinejoin="round" stroke={scene.starfish} strokeWidth={2} />
        {[0, 1, 2, 3, 4].map((i) => {
          const a = ((Math.PI * 2) / 5) * i - Math.PI / 2;
          return <Circle key={i} cx={15 + 7 * Math.cos(a)} cy={15 + 7 * Math.sin(a)} r={1} fill="#FFF8EF" opacity={0.7} />;
        })}
      </Svg>
    </View>
  );
}

// Campfire; the flame flickers only when `lit` (golden hour / night) and animating.
export function Campfire({ x, y, lit, active }: { x: number; y: number; lit: boolean; active: boolean }) {
  const flicker = useLoop(380, active && lit, { reverse: true });
  const flame = useAnimatedStyle(() => ({
    transform: [{ scaleY: 0.85 + flicker.value * 0.25 }, { scaleX: 1 - flicker.value * 0.08 }],
  }));
  const W = 56;
  return (
    <View pointerEvents="none" style={[styles.abs, { left: x - W / 2, top: y - 60, width: W, height: 64 }]}>
      {lit && (
        <>
          <View style={[styles.glow, { left: -22, top: 4 }]} />
          <Animated.View style={[styles.flame, { transformOrigin: "50% 100%" }, flame]}>
            <Svg width={32} height={40} viewBox="0 0 32 40">
              <Path d="M16 40 C4 36 4 22 12 14 C12 22 16 22 16 22 C14 12 18 6 22 0 C22 10 30 16 28 28 C27 36 22 40 16 40 Z" fill={scene.fire} />
              <Path d="M16 40 C10 38 10 30 14 25 C15 30 18 30 18 30 C18 26 20 24 22 22 C24 30 23 38 16 40 Z" fill={scene.fireCore} />
            </Svg>
          </Animated.View>
        </>
      )}
      <Svg width={W} height={20} viewBox="0 0 56 20" style={styles.logs}>
        <Rect x={4} y={8} width={48} height={8} rx={4} fill={scene.woodDark} transform="rotate(-10 28 12)" />
        <Rect x={4} y={8} width={48} height={8} rx={4} fill={scene.wood} transform="rotate(10 28 12)" />
      </Svg>
    </View>
  );
}

// String lights hanging in a gentle curve between two points (the palm tops).
export function StringLights({
  from,
  to,
  glow,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  glow: number; // 0 (day) … 1 (night)
}) {
  const left = Math.min(from.x, to.x) - 10;
  const top = Math.min(from.y, to.y) - 10;
  const w = Math.abs(to.x - from.x) + 20;
  const h = Math.abs(to.y - from.y) + 70;
  const a = { x: from.x - left, y: from.y - top };
  const b = { x: to.x - left, y: to.y - top };
  const sag = 50;
  const ctrl = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + sag };
  const bulbs = Array.from({ length: 11 }, (_, i) => {
    const t = (i + 1) / 12;
    const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * ctrl.x + t * t * b.x;
    const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * ctrl.y + t * t * b.y;
    return { x, y };
  });
  return (
    <View pointerEvents="none" style={[styles.abs, { left, top, width: w, height: h }]}>
      <Svg width={w} height={h}>
        <Path d={`M${a.x} ${a.y} Q${ctrl.x} ${ctrl.y} ${b.x} ${b.y}`} stroke="#3A2E26" strokeWidth={1.2} fill="none" opacity={0.6} />
        {bulbs.map((p, i) => (
          <G key={i}>
            {glow > 0.1 && <Circle cx={p.x} cy={p.y + 5} r={8} fill={scene.bulb} opacity={0.35 * glow} />}
            <Circle cx={p.x} cy={p.y + 5} r={3.2} fill={scene.bulb} opacity={0.55 + 0.45 * glow} />
          </G>
        ))}
      </Svg>
    </View>
  );
}

export function Hut({ x, y, width = 120 }: { x: number; y: number; width?: number }) {
  const h = width * 0.85;
  return (
    <View pointerEvents="none" style={[styles.abs, { left: x - width / 2, top: y - h, width, height: h }]}>
      <Svg width={width} height={h} viewBox="0 0 120 102">
        <G transform="translate(2 3)" opacity={0.12}>
          <Path d="M4 44 L60 6 L116 44 Z" fill="#000" />
          <Rect x={18} y={44} width={84} height={52} fill="#000" />
        </G>
        {/* stilts */}
        <Rect x={22} y={90} width={5} height={12} fill={scene.woodDark} />
        <Rect x={93} y={90} width={5} height={12} fill={scene.woodDark} />
        <Rect x={18} y={44} width={84} height={48} fill={scene.hutWall} />
        {[54, 64, 74, 84].map((yy) => (
          <Rect key={yy} x={18} y={yy} width={84} height={1.5} fill={scene.woodDark} opacity={0.25} />
        ))}
        <Rect x={50} y={60} width={20} height={32} rx={2} fill={scene.woodDark} />
        <Rect x={26} y={56} width={16} height={14} rx={2} fill={scene.seaShallow} opacity={0.8} />
        <Path d="M4 44 L60 6 L116 44 Z" fill={scene.hutRoof} />
        {[16, 26, 36].map((yy) => (
          <Path key={yy} d={`M${60 - yy * 1.45} ${yy + 6 + 4} L${60 + yy * 1.45} ${yy + 6 + 4}`} stroke={scene.woodDark} strokeWidth={1.5} opacity={0.35} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  glow: {
    position: "absolute",
    width: 100,
    height: 60,
    borderRadius: 50,
    backgroundColor: scene.fire,
    opacity: 0.18,
  },
  flame: { position: "absolute", left: 12, top: 4 },
  logs: { position: "absolute", bottom: 0 },
});
