import { YearStone } from "@/components/beach/Anniversary";
import { Body, Button, PressableScale } from "@/components/ui";
import { anniversaryDate, anniversaryStatus, partnerHasAnsweredAnniversary } from "@/lib/anniversary";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radius, shadows, space } from "@/theme";
import { formatLongDate } from "@/components/ui";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SectionHeading } from "./SectionHeading";

type YearRow = { year: number; date: Date; mine: boolean; theirs: boolean };

// "Our years": one line per anniversary reached — its stone, "Year N", the
// date, "Watch our year", and where the next-chapter answers stand.
export function OurYears({ coupleId, myId, start, partnerName, refreshKey }: { coupleId: string; myId: string; start: string; partnerName: string; refreshKey: number }) {
  const [rows, setRows] = useState<YearRow[] | null>(null);

  useEffect(() => {
    const { reached } = anniversaryStatus(start);
    if (reached === 0) return setRows([]);
    (async () => {
      // my rows + (revealed) theirs in one query; the RPC tells me if theirs exists unseen
      const { data } = await supabase.from("anniversary_answers").select("anniversary_year, user_id").eq("couple_id", coupleId);
      const list: YearRow[] = [];
      for (let y = reached; y >= 1; y--) {
        const mine = (data ?? []).some((r) => r.anniversary_year === y && r.user_id === myId);
        const theirs = (data ?? []).some((r) => r.anniversary_year === y && r.user_id !== myId) || (await partnerHasAnsweredAnniversary(y).catch(() => false));
        list.push({ year: y, date: anniversaryDate(start, y), mine, theirs });
      }
      setRows(list);
    })();
  }, [coupleId, myId, start, refreshKey]);

  if (!rows || rows.length === 0) return null;

  return (
    <View>
      <SectionHeading icon="sun" title="Our years" />
      {rows.map((r) => {
        const status = r.mine && r.theirs ? "You both answered 💌" : r.mine ? `Sealed — waiting for ${partnerName}` : r.theirs ? `${partnerName} answered 👀 — your turn` : "Where should our next chapter take us?";
        return (
          <View key={r.year} style={[styles.page, { transform: [{ rotate: `${r.year % 2 ? -0.6 : 0.6}deg` }] }]}>
            <View style={styles.row}>
              <YearStone n={r.year} size={40} />
              <View style={styles.flex}>
                <Text style={styles.year}>Year {r.year}</Text>
                <Body variant="small" color={colors.inkSoft}>
                  {formatLongDate(r.date)}
                </Body>
              </View>
            </View>
            <Button title="Watch our year" icon="film" variant="soft" onPress={() => router.push({ pathname: "/anniversary/[year]", params: { year: String(r.year) } })} style={styles.watch} />
            <PressableScale
              onPress={() => router.push({ pathname: "/anniversary/[year]", params: { year: String(r.year), page: "answer" } })}
              accessibilityRole="button"
              accessibilityLabel={`${status}. Open`}
              style={styles.status}
            >
              <Body variant="small" color={r.mine && r.theirs ? colors.coral : colors.ocean}>
                {status}
              </Body>
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.warmWhite, borderRadius: radius.paper, padding: space.lg, marginBottom: space.md, ...shadows.paper },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
  year: { fontFamily: fonts.headingItalic, fontSize: 22, lineHeight: 28, color: colors.inkOcean },
  watch: { marginTop: space.md },
  status: { marginTop: space.sm, alignSelf: "center", padding: space.xs },
});
