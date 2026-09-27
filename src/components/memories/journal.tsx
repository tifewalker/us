import {
    Body,
    formatLongDate,
    Handwritten,
    Icon3D,
    PaperCard,
    Polaroid,
    Title,
} from "@/components/ui";
import { VinylBadge } from "@/components/music/VinylRecord";
import { formatSeconds } from "@/lib/memories";
import { colors, scene, space, type TapeColor } from "@/theme";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Ellipse, G, Path } from "react-native-svg";

export type ClusterPhoto = {
  id: string;
  uri: string | null;
  cacheKey: string | null;
  isVideo: boolean;
  duration: number | null;
};

export type JournalMemory = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  date: Date; // memory_date, or created_at when no date was set
  hasSong?: boolean;
  bothSides?: boolean; // both of you wrote "What do you remember?"
};

const TAPES: TapeColor[] = ["sand", "sky", "coral", "mint"];

// One memory on the journal page: 1–3 overlapping polaroids + tape on one side,
// title / date / first line (Caveat) on the other. Sides alternate.
export const MemoryCluster = memo(
  function MemoryCluster({
    memory,
    photos,
    side,
    index,
    contentWidth,
    onPress,
  }: {
    memory: JournalMemory;
    photos: ClusterPhoto[];
    side: "left" | "right";
    index: number;
    contentWidth: number;
    onPress: () => void;
  }) {
    const main = Math.min(170, contentWidth * 0.5);
    const small = main * 0.66;
    const firstLine = memory.description?.split("\n").find((l) => l.trim())?.trim();
    const shown = photos.slice(0, 3);

    return (
      <View style={[styles.cluster, { flexDirection: side === "left" ? "row" : "row-reverse" }]}>
        <View style={{ width: main + 28, height: main + 58 }}>
          {shown.length === 0 && (
            <Polaroid seed={memory.id} width={main} onPress={onPress} accessibilityLabel={memory.title} tape={TAPES[index % 4]} />
          )}
          {/* back-most first so the main photo sits on top */}
          {shown
            .map((p, i) => ({ p, i }))
            .reverse()
            .map(({ p, i }) => (
              <View
                key={p.id}
                style={[
                  styles.abs,
                  i === 0
                    ? { left: 0, top: 10 }
                    : i === 1
                      ? { left: side === "left" ? main * 0.52 : -main * 0.18, top: 0 }
                      : { left: side === "left" ? main * 0.4 : -main * 0.06, top: main * 0.55 },
                ]}
              >
                <Polaroid
                  seed={p.id}
                  uri={p.uri}
                  cacheKey={p.cacheKey}
                  width={i === 0 ? main : small}
                  isVideo={p.isVideo}
                  videoDuration={p.duration != null ? formatSeconds(p.duration) : null}
                  tape={i === 0 ? TAPES[index % 4] : undefined}
                  onPress={onPress}
                  accessibilityLabel={`${memory.title}${p.isVideo ? ", video" : ""}`}
                />
              </View>
            ))}
        </View>

        <View style={[styles.text, side === "left" ? styles.textRight : styles.textLeft]}>
          <View style={[styles.titleRow, side === "right" && styles.titleRowEnd]}>
            <Title variant="heading" numberOfLines={2} onPress={onPress} style={styles.titleText}>
              {memory.title}
            </Title>
            {memory.hasSong ? <VinylBadge size={18} /> : null}
          </View>
          {memory.bothSides ? (
            <View style={[styles.sidesBadge, side === "right" && styles.sidesBadgeEnd]}>
              <Body variant="small" color={colors.inkOcean} style={styles.sidesText}>
                2 sides
              </Body>
            </View>
          ) : null}
          <Body variant="small" color={colors.inkSoft} style={styles.date}>
            {formatLongDate(memory.date)}
            {memory.location ? ` · ${memory.location}` : ""}
          </Body>
          {firstLine ? (
            <Handwritten variant="handSmall" numberOfLines={2} style={styles.line}>
              {firstLine}
            </Handwritten>
          ) : null}
        </View>
      </View>
    );
  },
  (a, b) =>
    a.memory === b.memory &&
    a.side === b.side &&
    a.contentWidth === b.contentWidth &&
    a.photos.map((p) => p.uri).join() === b.photos.map((p) => p.uri).join(),
);

// A dashed footprint path winding from one cluster's side to the next.
export const FootprintTrail = memo(function FootprintTrail({
  from,
  width,
}: {
  from: "left" | "right";
  width: number;
}) {
  const h = 64;
  const x1 = from === "left" ? width * 0.25 : width * 0.75;
  const x2 = from === "left" ? width * 0.75 : width * 0.25;
  const d = `M ${x1} 0 C ${x1} ${h * 0.6} ${x2} ${h * 0.4} ${x2} ${h}`;
  const steps = 5;
  const prints = Array.from({ length: steps }, (_, i) => {
    const t = (i + 0.5) / steps;
    const mt = 1 - t;
    // cubic bezier point + tangent
    const x = mt ** 3 * x1 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t ** 3 * x2;
    const y = 3 * mt * mt * t * h * 0.6 + 3 * mt * t * t * h * 0.4 + t ** 3 * h;
    const dx = 3 * mt * mt * 0 + 6 * mt * t * (x2 - x1) + 3 * t * t * 0;
    const dy = 3 * mt * mt * (h * 0.6) + 6 * mt * t * (h * 0.4 - h * 0.6) + 3 * t * t * (h - h * 0.4);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    return { x: x + (i % 2 ? 5 : -5), y, angle };
  });
  return (
    <View style={{ height: h }} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={h}>
        <Path d={d} stroke={scene.footprint} strokeWidth={1.5} strokeDasharray="4 6" fill="none" opacity={0.7} />
        {prints.map((p, i) => (
          <G key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.angle})`} opacity={0.55}>
            <Ellipse cx={0} cy={0} rx={2.6} ry={4.6} fill={scene.footprint} />
            <Ellipse cx={0} cy={-6} rx={1.7} ry={1.5} fill={scene.footprint} />
          </G>
        ))}
      </Svg>
    </View>
  );
});

export function MonthHeading({ label }: { label: string }) {
  return (
    <Title variant="headingItalic" color={colors.inkSoft} style={styles.month} accessibilityRole="header">
      {label}
    </Title>
  );
}

// "The beginning" page — always present (first or last, by sort order).
export function BeginningPage({ date }: { date: Date | null }) {
  return (
    <PaperCard style={styles.beginning}>
      <Icon3D name="beach" size={72} />
      <Title variant="titleItalic" center style={styles.beginningTitle}>
        The beginning
      </Title>
      {date && (
        <Body variant="label" color={colors.inkSoft} center>
          {formatLongDate(date)}
        </Body>
      )}
      <Handwritten center style={styles.beginningLine}>
        It all started here.
      </Handwritten>
    </PaperCard>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  cluster: { alignItems: "center", gap: space.md },
  text: { flex: 1 },
  textRight: { paddingLeft: space.xs },
  textLeft: { paddingRight: space.xs, alignItems: "flex-end" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  titleRowEnd: { justifyContent: "flex-end" },
  titleText: { flexShrink: 1 },
  sidesBadge: {
    alignSelf: "flex-start",
    marginTop: space.xs,
    backgroundColor: colors.sand,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    transform: [{ rotate: "-2deg" }],
  },
  sidesBadgeEnd: { alignSelf: "flex-end" },
  sidesText: { fontSize: 11, lineHeight: 15 },
  date: { marginTop: space.xs },
  line: { marginTop: space.xs, color: colors.ink },
  month: { marginTop: space.xl, marginBottom: space.lg },
  beginning: {
    alignItems: "center",
    padding: space.xl,
    marginTop: space.xl,
    marginBottom: space.xl,
    transform: [{ rotate: "-1deg" }],
  },
  beginningTitle: { marginTop: space.md },
  beginningLine: { marginTop: space.sm },
});
