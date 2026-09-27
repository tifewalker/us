import { Handwritten, PressableScale } from "@/components/ui";
import { colors, scene, shadows } from "@/theme";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

const shadow = { fill: "#000", opacity: 0.12 } as const;

// A game object lying on the towel: the drawing + one Caveat status line.
function TowelObject({
  children,
  status,
  label,
  tilt,
  onPress,
}: {
  children: ReactNode;
  status: string;
  label: string;
  tilt: number;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}. ${status}`} style={[styles.object, { transform: [{ rotate: `${tilt}deg` }] }]}>
      {children}
      <Handwritten variant="handSmall" center numberOfLines={2} style={styles.status}>
        {status}
      </Handwritten>
    </PressableScale>
  );
}

export function CardDeck({ status, onPress }: { status: string; onPress: () => void }) {
  return (
    <TowelObject label="Questions" status={status} tilt={-6} onPress={onPress}>
      <Svg width={96} height={110} viewBox="0 0 96 110">
        {[10, 6, 2].map((o, i) => (
          <G key={i} transform={`rotate(${(i - 1) * 6} 48 55)`}>
            <Rect x={14 + 3} y={o + 4} width={64} height={92} rx={6} {...shadow} />
            <Rect x={14} y={o} width={64} height={92} rx={6} fill={i === 2 ? colors.warmWhite : colors.paperDeep} stroke={colors.paperEdge} strokeWidth={1.5} />
          </G>
        ))}
        <Path d="M40 42 C40 32 56 32 56 42 C56 50 48 50 48 58" stroke={colors.ocean} strokeWidth={4} fill="none" strokeLinecap="round" />
        <Circle cx={48} cy={68} r={2.8} fill={colors.ocean} />
      </Svg>
    </TowelObject>
  );
}

export function SealedEnvelope({ status, onPress }: { status: string; onPress: () => void }) {
  return (
    <TowelObject label="Secret missions" status={status} tilt={5} onPress={onPress}>
      <Svg width={112} height={86} viewBox="0 0 112 86">
        <Rect x={9} y={11} width={96} height={68} rx={4} {...shadow} />
        <Rect x={6} y={8} width={96} height={68} rx={4} fill={colors.warmWhite} stroke={colors.paperEdge} strokeWidth={1.5} />
        <Path d="M6 76 L54 42 L102 76" stroke={colors.paperEdge} strokeWidth={1.5} fill="none" />
        <Path d="M6 8 L54 48 L102 8 Z" fill={colors.paperDeep} stroke={colors.paperEdge} strokeWidth={1.5} />
        {/* coral wax seal */}
        <Circle cx={54} cy={48} r={12} fill={colors.coral} />
        <Circle cx={54} cy={48} r={8} fill="none" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1.5} />
        <Path d="M50 47 C50 44 54 44 54 47 C54 44 58 44 58 47 C58 50 54 53 54 53 C54 53 50 50 50 47 Z" fill="#FFFFFF" opacity={0.7} />
      </Svg>
    </TowelObject>
  );
}

const WHEEL_COLORS = [colors.coral, colors.sand, colors.sky, colors.sunset, scene.palmLeaf, colors.warmWhite];

export function SmallWheel({ status, onPress }: { status: string; onPress: () => void }) {
  const r = 38;
  const segs = WHEEL_COLORS.map((c, i) => {
    const a0 = (i / WHEEL_COLORS.length) * Math.PI * 2;
    const a1 = ((i + 1) / WHEEL_COLORS.length) * Math.PI * 2;
    const p = (a: number) => `${50 + r * Math.cos(a)} ${46 + r * Math.sin(a)}`;
    return <Path key={i} d={`M50 46 L${p(a0)} A${r} ${r} 0 0 1 ${p(a1)} Z`} fill={c} />;
  });
  return (
    <TowelObject label="Roulette" status={status} tilt={-3} onPress={onPress}>
      <Svg width={100} height={96} viewBox="0 0 100 96">
        <Circle cx={53} cy={50} r={r + 3} {...shadow} />
        <Circle cx={50} cy={46} r={r + 3} fill={scene.woodDark} />
        {segs}
        <Circle cx={50} cy={46} r={6} fill={colors.warmWhite} stroke={scene.woodDark} strokeWidth={2} />
        <Path d="M50 2 L44 12 L56 12 Z" fill={colors.inkOcean} />
      </Svg>
    </TowelObject>
  );
}

export function FoldedNote({ status, onPress }: { status: string; onPress: () => void }) {
  return (
    <TowelObject label="Today's moment" status={status} tilt={7} onPress={onPress}>
      <Svg width={96} height={84} viewBox="0 0 96 84">
        <Path d="M11 13 L85 9 L89 75 L15 79 Z" {...shadow} />
        <Path d="M8 10 L82 6 L86 72 L12 76 Z" fill={colors.sand} stroke={colors.paperEdge} strokeWidth={1.5} />
        <Path d="M10 41 L84 37" stroke={colors.paperEdge} strokeWidth={1.5} strokeDasharray="3 4" />
        <Path d="M66 6 L82 6 L82 20 Z" fill={colors.paperDeep} />
        {[22, 28, 52, 58].map((y) => (
          <Path key={y} d={`M20 ${y} L${y < 40 ? 64 : 70} ${y - 2}`} stroke={colors.inkFaint} strokeWidth={2} strokeLinecap="round" />
        ))}
      </Svg>
    </TowelObject>
  );
}

const styles = StyleSheet.create({
  object: { alignItems: "center", width: 140, gap: 2 },
  status: { color: colors.inkOcean, fontSize: 18, lineHeight: 20 },
});
