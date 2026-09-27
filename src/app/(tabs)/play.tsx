import { CardDeck, FoldedNote, SealedEnvelope, SmallWheel } from "@/components/play/PlayObjects";
import { SpicyToggle } from "@/components/play/SpicyToggle";
import { usePlayContext } from "@/components/play/usePlayContext";
import { EmptyState, ScreenBackground, Title, useTabBarClearance } from "@/components/ui";
import { getPlaySummary, type PlaySummary } from "@/lib/play";
import { refreshPlayBadge } from "@/lib/playBadge";
import { getTodayStatus, type TodayStatus } from "@/lib/world";
import { colors, GUTTER, radius, scene, shadows, space } from "@/theme";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TODAY_LINE: Record<TodayStatus, string> = {
  noPartner: "Opens once you're paired",
  fresh: "Something's waiting for you",
  yourTurn: "Your partner answered — your turn 👀",
  waiting: "Waiting for your partner",
  revealed: "Revealed ❤️",
};

// The Play tab: a beach towel seen from above with the games lying on it as
// objects — a deck of cards (questions), a sealed envelope (secret missions),
// a small wheel (roulette) and a folded note (today's moment).
export default function Play() {
  const insets = useSafeAreaInsets();
  const tabClearance = useTabBarClearance();
  const { ctx, reload } = usePlayContext();
  const [summary, setSummary] = useState<PlaySummary | null>(null);
  const [today, setToday] = useState<TodayStatus>("fresh");

  const loadSummary = useCallback(async () => {
    if (!ctx) return;
    const [s, t] = await Promise.all([
      getPlaySummary(ctx.coupleId, ctx.myId).catch(() => null),
      getTodayStatus(ctx.coupleId, ctx.myId, !!ctx.partnerId).catch(() => "fresh" as TodayStatus),
    ]);
    setSummary(s);
    setToday(t);
    refreshPlayBadge();
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary]),
  );

  if (!ctx) {
    return (
      <ScreenBackground aboveTabBar>
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </ScreenBackground>
    );
  }

  if (!ctx.partnerId) {
    return (
      <ScreenBackground aboveTabBar>
        <EmptyState icon="die" title="Games for two" message="These open once your partner joins 🌊" style={styles.center} />
      </ScreenBackground>
    );
  }

  const name = ctx.partnerName;
  const deckLine = summary?.questionsWaitingForMe ? `${name} asked you something 👀` : `Ask ${name} something`;
  const missionLine = summary?.unseenMissionReveal
    ? "Missions revealed 💌"
    : summary?.missionToday
      ? summary.missionToday.completed_at
        ? "Mission done ✅"
        : "On a mission 🤫"
      : "Draw today's mission";

  return (
    <ScreenBackground padded={false}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xl, paddingBottom: tabClearance }]}>
        <Title variant="titleItalic">Play</Title>

        {/* the towel, from above */}
        <View style={styles.towel} accessibilityLabel="Beach towel with four games">
          <View style={styles.towelClip} pointerEvents="none">
            {Array.from({ length: 7 }, (_, i) => (
              <View key={i} style={[styles.stripe, { left: `${i * 16 - 2}%`, backgroundColor: i % 2 ? scene.towelB : scene.towelA }]} />
            ))}
            <View style={[styles.fringe, { top: -6 }]} />
            <View style={[styles.fringe, { bottom: -6 }]} />
          </View>
          <View style={styles.grid}>
            <CardDeck status={deckLine} onPress={() => router.push("/play/questions")} />
            <SealedEnvelope status={missionLine} onPress={() => router.push("/play/missions")} />
            <SmallWheel status="Spin something fun" onPress={() => router.push("/play/roulette")} />
            <FoldedNote status={TODAY_LINE[today]} onPress={() => router.push("/activity/today")} />
          </View>
        </View>

        <View style={styles.spicy}>
          <SpicyToggle
            coupleId={ctx.coupleId}
            myId={ctx.myId}
            partnerName={name}
            state={ctx.spicy}
            onChanged={reload}
          />
        </View>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: GUTTER },
  towel: {
    marginTop: space.xl,
    borderRadius: radius.paper,
    paddingVertical: space.xxl,
    paddingHorizontal: space.sm,
    transform: [{ rotate: "-1.2deg" }],
    ...shadows.paper,
  },
  towelClip: { ...StyleSheet.absoluteFill, borderRadius: radius.paper, overflow: "hidden", backgroundColor: scene.towelB },
  stripe: { position: "absolute", top: 0, bottom: 0, width: "16%", opacity: 0.55 },
  fringe: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 12,
    borderStyle: "dashed",
    borderWidth: 3,
    borderColor: colors.warmWhite,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", rowGap: space.xl },
  spicy: { marginTop: space.xl },
});
