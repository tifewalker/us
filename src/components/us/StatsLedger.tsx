import { Handwritten, Title, WashiTape } from "@/components/ui";
import { getCoupleStats, type CoupleStats } from "@/lib/stats";
import { colors, radius, shadows, space, type as typeScale } from "@/theme";
import { useEffect, useState, type ReactElement } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { SectionHeading } from "./SectionHeading";

// "Our stats": a lined ledger page of handwritten tallies — small numbers as
// tally marks (groups of five), bigger ones written out in Caveat. Not a
// dashboard grid.
export function StatsLedger({
  coupleId,
  myId,
  start,
  myName,
  partnerName,
  refreshKey,
}: {
  coupleId: string;
  myId: string;
  start: string;
  myName: string;
  partnerName: string;
  refreshKey: number;
}) {
  const [stats, setStats] = useState<CoupleStats | null>(null);
  useEffect(() => {
    getCoupleStats({ coupleId, myId, relationshipStart: start })
      .then(setStats)
      .catch((e) => console.log("[Stats]", e.message));
  }, [coupleId, myId, start, refreshKey]);

  const rows: [string, number][] = stats
    ? [
        ["memories", stats.memories],
        ["photos", stats.photos],
        ["videos", stats.videos],
        ["voice notes", stats.voiceNotes],
        ["songs picked", stats.songsPicked],
        [`bottles from ${myName}`, stats.bottlesSent.me],
        [`bottles from ${partnerName}`, stats.bottlesSent.partner],
        ["questions answered together", stats.questionsAnsweredTogether],
        ["same brain moments", stats.sameBrain],
        ["secret missions done", stats.missionsCompleted],
        ["roulette dares done", stats.rouletteDone],
        ["bucket list ticks", stats.bucketDone],
      ]
    : [];

  return (
    <View>
      <SectionHeading icon="hourglass" title="Our stats" />
      <View style={styles.page}>
        <WashiTape color="mint" rotate={-6} style={styles.tape} />
        {!stats ? (
          <ActivityIndicator color={colors.coral} />
        ) : (
          <>
            <View style={styles.hero}>
              <Title variant="display" color={colors.inkOcean}>
                {stats.daysTogether.toLocaleString()}
              </Title>
              <Handwritten color={colors.inkSoft}>days together</Handwritten>
            </View>
            {rows.map(([label, n]) => (
              <View key={label} style={styles.line}>
                <View style={styles.count}>{n > 0 && n <= 20 ? <Tally n={n} /> : <Handwritten>{n.toLocaleString()}</Handwritten>}</View>
                <Text style={[typeScale.small, styles.label]}>{label}</Text>
              </View>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

// Tally marks: four uprights and a diagonal per five, hand-wobbly.
export function Tally({ n, color = colors.ink }: { n: number; color?: string }) {
  const groups = Math.ceil(n / 5);
  const w = groups * 30;
  const marks: ReactElement[] = [];
  for (let g = 0; g < groups; g++) {
    const inGroup = Math.min(5, n - g * 5);
    const x0 = g * 30 + 3;
    for (let i = 0; i < Math.min(4, inGroup); i++) {
      const x = x0 + i * 5;
      marks.push(<Line key={`${g}-${i}`} x1={x} y1={3 + (i % 2)} x2={x + 0.8} y2={21 - (i % 2)} stroke={color} strokeWidth={2} strokeLinecap="round" />);
    }
    if (inGroup === 5) marks.push(<Line key={`${g}-x`} x1={x0 - 3} y1={17} x2={x0 + 19} y2={6} stroke={colors.coral} strokeWidth={2} strokeLinecap="round" />);
  }
  return (
    <Svg width={w} height={24} accessibilityLabel={String(n)}>
      {marks}
    </Svg>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.paper, borderRadius: radius.paper, padding: space.xl, paddingTop: space.xl, transform: [{ rotate: "0.6deg" }], ...shadows.paper },
  tape: { position: "absolute", top: -10, left: space.xl },
  hero: { alignItems: "center", marginBottom: space.md },
  line: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 38, borderBottomWidth: 1, borderBottomColor: "#BFE3F0" /* ruled line (tapeSky) */ },
  count: { minWidth: 72 },
  label: { color: colors.inkSoft, flex: 1 },
});
