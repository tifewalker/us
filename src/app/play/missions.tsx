import { AddCardSheet } from "@/components/play/AddCardSheet";
import { BackButton } from "@/components/play/BackButton";
import { usePlayContext } from "@/components/play/usePlayContext";
import { FloatingHearts } from "@/components/moments/effects";
import { Body, Button, formatLongDate, Handwritten, Input, PressableScale, ScreenBackground, successHaptic, Title } from "@/components/ui";
import { localDateString, parseLocalDate } from "@/lib/dates";
import {
    categoryLabel,
    completeMission,
    drawMission,
    getCards,
    getMissionHistory,
    getMyMission,
    getPartnerMission,
    hasRedrawnToday,
    markMissionRevealSeen,
    markRedrawn,
    MISSION_CATEGORIES,
    partnerHasMissionToday,
    setNoticed,
    skipMission,
    SPICY_TEASER,
    type Card,
    type Mission,
} from "@/lib/play";
import { refreshPlayBadge } from "@/lib/playBadge";
import { colors, fonts, GUTTER, radius, shadows, space, type as typeScale } from "@/theme";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

// Secret missions: draw one of three sealed cards, do it without saying,
// then both missions are revealed (when you've both finished, or next day).
export default function Missions() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { ctx } = usePlayContext();
  const today = localDateString();
  const yesterday = localDateString(new Date(Date.now() - 86_400_000));

  const [mine, setMine] = useState<Mission | null | undefined>(undefined);
  const [templates, setTemplates] = useState<Card[]>([]);
  const [partnerOn, setPartnerOn] = useState(false);
  const [redrawn, setRedrawn] = useState(false);
  const [reveals, setReveals] = useState<{ date: string; mine: Mission | null; theirs: Mission }[]>([]);
  const [history, setHistory] = useState<Mission[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [flipping, setFlipping] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [hearts, setHearts] = useState(false);

  const load = useCallback(async () => {
    if (!ctx) return;
    const [m, t, on, r, hist] = await Promise.all([
      getMyMission(ctx.coupleId, ctx.myId, today).catch(() => null),
      getCards("mission_templates").catch(() => [] as Card[]),
      partnerHasMissionToday(today).catch(() => false),
      hasRedrawnToday(ctx.myId),
      getMissionHistory(ctx.coupleId).catch(() => [] as Mission[]),
    ]);
    setMine(m);
    setTemplates(t);
    setPartnerOn(on);
    setRedrawn(r);
    // spicy missions disappear from history while spicy mode is off
    setHistory(hist.filter((x) => ctx.spicy.on || x.category !== "spicy"));
    const found: { date: string; mine: Mission | null; theirs: Mission }[] = [];
    for (const date of [today, yesterday]) {
      const theirs = await getPartnerMission(ctx.coupleId, ctx.myId, date).catch(() => null); // only once revealed (RLS)
      if (theirs && (ctx.spicy.on || theirs.category !== "spicy")) {
        const myOne = date === today ? m : hist.find((x) => x.assignee_id === ctx.myId && x.mission_date === date) ?? null;
        found.push({ date, mine: myOne, theirs });
        markMissionRevealSeen(ctx.myId, date);
      }
    }
    setReveals(found);
    refreshPlayBadge();
  }, [ctx, today, yesterday]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!ctx || mine === undefined) {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </ScreenBackground>
    );
  }

  function randomTemplate(exclude?: string | null) {
    const pool = templates.filter((t) => t.id !== exclude && (ctx!.spicy.on || t.category !== "spicy"));
    return pool[Math.floor(Math.random() * pool.length)];
  }

  async function draw(index: number) {
    if (!ctx || busy) return;
    const t = randomTemplate();
    if (!t) return Alert.alert("No missions yet", "Add your own card to get started.");
    setBusy(true);
    setFlipping(index);
    try {
      const m = await drawMission(ctx.coupleId, ctx.myId, t);
      setTimeout(() => setMine(m), 650);
    } catch (e: any) {
      Alert.alert("Couldn't draw a mission", e.message ?? String(e));
      setFlipping(null);
    } finally {
      setTimeout(() => {
        setBusy(false);
        setFlipping(null);
      }, 700);
    }
  }

  async function redraw() {
    if (!ctx || !mine) return;
    const t = randomTemplate(mine.template_id);
    if (!t) return;
    setBusy(true);
    try {
      setMine(await drawMission(ctx.coupleId, ctx.myId, t, mine.id));
      await markRedrawn(ctx.myId);
      setRedrawn(true);
    } catch (e: any) {
      Alert.alert("Couldn't draw again", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function done() {
    if (!mine) return;
    setBusy(true);
    try {
      await completeMission(mine.id, note.trim() || null);
      successHaptic();
      setHearts(true);
      setTimeout(() => setHearts(false), 3000);
      await load();
    } catch (e: any) {
      Alert.alert("Couldn't save", e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const duration = mine?.template_id ? templates.find((t) => t.id === mine.template_id)?.duration : undefined;
  const past = history.filter((m) => m.mission_date !== today && m.assignee_id === ctx.myId);

  return (
    <ScreenBackground padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]} keyboardShouldPersistTaps="handled">
          <BackButton />
          <Title variant="titleItalic" style={styles.title}>
            Secret missions
          </Title>
          {partnerOn && (
            <Body color={colors.inkOcean} style={styles.partnerLine}>
              {ctx.partnerName} is on a secret mission 🤫
            </Body>
          )}

          {/* ---- reveals (both done today, or yesterday's) ---- */}
          {reveals.map((r) => (
            <RevealPair key={r.date} date={r.date} mine={r.mine} theirs={r.theirs} partnerName={ctx.partnerName} onNoticed={load} />
          ))}

          {/* ---- today ---- */}
          {!mine ? (
            <View style={styles.section}>
              <Body color={colors.inkSoft} center>
                Pick a card. Do it today without saying a word.
              </Body>
              <View style={styles.fan}>
                {[0, 1, 2].map((i) => (
                  <SealedCard key={i} index={i} flipping={flipping === i} onPress={() => draw(i)} disabled={busy} />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.missionCard}>
                <View style={styles.row}>
                  <Tag text={categoryLabel(mine.category)} spicy={mine.category === "spicy"} />
                  {duration && <Tag text={categoryLabel(duration)} />}
                </View>
                <Title variant="heading" style={styles.missionText}>
                  {mine.mission_text}
                </Title>
              </View>

              {mine.completed_at ? (
                <Body color={colors.inkOcean} center>
                  Done ✅ {reveals.length === 0 ? `— it's revealed once ${ctx.partnerName} finishes theirs, or tomorrow.` : ""}
                </Body>
              ) : (
                <>
                  <Input placeholder="What I did (optional)" value={note} onChangeText={setNote} multiline maxLength={500} style={styles.noteInput} />
                  <Button title="Done ✅" onPress={done} loading={busy} />
                  {!redrawn && <Button title="Draw again" variant="text" onPress={redraw} disabled={busy} />}
                  {mine.category === "spicy" && (
                    // spicy Skip: deletes today's mission — nothing is kept
                    <Button
                      title="Skip"
                      variant="text"
                      onPress={async () => {
                        await skipMission(mine.id).catch(() => {});
                        load();
                      }}
                      disabled={busy}
                    />
                  )}
                </>
              )}
            </View>
          )}

          <Button title="Add your own mission" variant="text" onPress={() => setAddOpen(true)} style={styles.addBtn} />

          {past.length > 0 && (
            <View style={styles.section}>
              <Title variant="headingItalic">Past missions</Title>
              {past.map((m) => (
                <PastRow key={m.id} mission={m} />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {hearts && <FloatingHearts width={width} height={500} count={10} />}

      <AddCardSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={load}
        table="mission_templates"
        categories={MISSION_CATEGORIES}
        spicyOn={ctx.spicy.on}
        coupleId={ctx.coupleId}
        myId={ctx.myId}
        title="Add a mission"
      />
    </ScreenBackground>
  );
}

// A face-down, wax-sealed card; flips when drawn (no flip with Reduce Motion).
function SealedCard({ index, flipping, onPress, disabled }: { index: number; flipping: boolean; onPress: () => void; disabled: boolean }) {
  const reduceMotion = useReducedMotion();
  const flip = useSharedValue(0);
  useEffect(() => {
    if (flipping) flip.value = withTiming(1, { duration: reduceMotion ? 0 : 600 });
  }, [flipping, flip, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotate: `${(index - 1) * 10}deg` }, { rotateY: `${flip.value * 180}deg` }],
    opacity: 1 - Math.max(0, flip.value - 0.8) * 5,
  }));
  return (
    <PressableScale onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={`Mission card ${index + 1}`}>
      <Animated.View style={[styles.sealed, { marginTop: index === 1 ? 0 : 18 }, style]}>
        <Svg width={36} height={36}>
          <Circle cx={18} cy={18} r={16} fill={colors.coral} />
          <Circle cx={18} cy={18} r={11} fill="none" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1.5} />
          <Path d="M13 17 C13 14 18 14 18 17 C18 14 23 14 23 17 C23 20 18 24 18 24 C18 24 13 20 13 17 Z" fill="#FFFFFF" opacity={0.7} />
        </Svg>
      </Animated.View>
    </PressableScale>
  );
}

function RevealPair({
  date,
  mine,
  theirs,
  partnerName,
  onNoticed,
}: {
  date: string;
  mine: Mission | null;
  theirs: Mission;
  partnerName: string;
  onNoticed: () => void;
}) {
  const { width } = useWindowDimensions();
  const side = width >= 380;
  async function answer(v: "noticed" | "no_idea") {
    try {
      await setNoticed(theirs.id, v);
      onNoticed();
    } catch (e: any) {
      Alert.alert("Couldn't save", e.message ?? String(e));
    }
  }
  return (
    <View style={styles.section}>
      <Title variant="headingItalic" color={colors.coral}>
        Missions revealed · {date === localDateString() ? "today" : formatLongDate(parseLocalDate(date))}
      </Title>
      <View style={side ? styles.sideBySide : styles.stack}>
        <Letter who="You" mission={mine} style={side ? styles.flex : undefined}>
          {mine?.noticed && (
            <Body variant="small" color={colors.inkOcean} style={styles.noticedLine}>
              {partnerName}: {mine.noticed === "noticed" ? "I noticed 😏" : "I had no idea 😂"}
            </Body>
          )}
        </Letter>
        <Letter who={partnerName} mission={theirs} style={side ? styles.flex : undefined}>
          {theirs.noticed ? (
            <Body variant="small" color={colors.inkOcean} style={styles.noticedLine}>
              You: {theirs.noticed === "noticed" ? "I noticed 😏" : "I had no idea 😂"}
            </Body>
          ) : (
            <View style={styles.noticeButtons}>
              <Body variant="label" color={colors.inkSoft}>
                Did you notice?
              </Body>
              <Button title="I noticed 😏" variant="soft" onPress={() => answer("noticed")} style={styles.smallBtn} />
              <Button title="I had no idea 😂" variant="soft" onPress={() => answer("no_idea")} style={styles.smallBtn} />
            </View>
          )}
        </Letter>
      </View>
    </View>
  );
}

function Letter({ who, mission, style, children }: { who: string; mission: Mission | null; style?: object; children?: React.ReactNode }) {
  return (
    <View style={[styles.letter, style]}>
      <Body variant="label" color={colors.inkSoft}>
        {who}
      </Body>
      {mission ? (
        <>
          <Title variant="heading" style={styles.letterText}>
            {mission.mission_text}
          </Title>
          {mission.what_i_did ? <Handwritten variant="handSmall">{mission.what_i_did}</Handwritten> : null}
          {!mission.completed_at && (
            <Body variant="small" color={colors.inkFaint}>
              Not finished
            </Body>
          )}
        </>
      ) : (
        <Body variant="small" color={colors.inkFaint}>
          No mission that day
        </Body>
      )}
      {children}
    </View>
  );
}

function PastRow({ mission }: { mission: Mission }) {
  const [open, setOpen] = useState(false);
  const spicy = mission.category === "spicy";
  return (
    <PressableScale onPress={() => setOpen((o) => !o)} accessibilityRole="button" style={styles.pastRow}>
      <Body variant="small" color={colors.inkSoft}>
        {formatLongDate(parseLocalDate(mission.mission_date))} · {mission.completed_at ? "done ✅" : "not finished"}
      </Body>
      <Handwritten variant="handSmall" numberOfLines={open ? undefined : 2}>
        {spicy && !open ? SPICY_TEASER : mission.mission_text}
      </Handwritten>
    </PressableScale>
  );
}

function Tag({ text, spicy = false }: { text: string; spicy?: boolean }) {
  return (
    <View style={[styles.tag, spicy && { backgroundColor: "#FFE3D8" }]}>
      <Text style={[typeScale.small, { color: colors.inkOcean }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: GUTTER },
  title: { marginTop: space.md },
  partnerLine: { marginTop: space.xs },
  section: { marginTop: space.xl, gap: space.md },
  fan: { flexDirection: "row", justifyContent: "center", marginTop: space.lg },
  sealed: {
    width: 104,
    height: 150,
    borderRadius: radius.paper,
    backgroundColor: colors.paperDeep,
    borderWidth: 1.5,
    borderColor: colors.paperEdge,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: -6,
    ...shadows.paper,
  },
  missionCard: { backgroundColor: colors.warmWhite, borderRadius: radius.paper, padding: space.xl, ...shadows.paper },
  row: { flexDirection: "row", gap: space.sm },
  missionText: { marginTop: space.md },
  tag: { backgroundColor: colors.paperDeep, borderRadius: radius.badge, paddingHorizontal: space.sm, paddingVertical: 2 },
  noteInput: { fontFamily: fonts.hand, fontSize: 20, lineHeight: 24, minHeight: 90 },
  addBtn: { marginTop: space.lg },
  sideBySide: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  stack: { gap: space.md },
  letter: { backgroundColor: colors.warmWhite, borderRadius: radius.paper, padding: space.lg, gap: space.xs, ...shadows.paper },
  letterText: { fontSize: 18, lineHeight: 24 },
  noticedLine: { marginTop: space.sm },
  noticeButtons: { marginTop: space.sm, gap: space.xs },
  smallBtn: { minHeight: 40, paddingHorizontal: space.md },
  pastRow: { backgroundColor: colors.warmWhite, borderRadius: radius.paper, padding: space.lg, ...shadows.lifted },
});
