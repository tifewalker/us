import { AddCardSheet } from "@/components/play/AddCardSheet";
import { BackButton } from "@/components/play/BackButton";
import { usePlayContext } from "@/components/play/usePlayContext";
import { Body, Button, Handwritten, PressableScale, ScreenBackground, tapHaptic, Title } from "@/components/ui";
import { seededTilt } from "@/components/ui/seeded";
import {
    askQuestion,
    categoryLabel,
    getCards,
    getThreads,
    QUESTION_CATEGORIES,
    SPICY_TEASER,
    type Card,
    type Thread,
} from "@/lib/play";
import { colors, GUTTER, radius, shadows, space, type as typeScale } from "@/theme";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

// Couple questions: pick a category, swipe the deck (left = skip, right =
// ask), and see your threads. Skipping never records anything.
export default function Questions() {
  const insets = useSafeAreaInsets();
  const { ctx } = usePlayContext();
  const [category, setCategory] = useState<string>("know_you");
  const [cards, setCards] = useState<Card[] | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [asking, setAsking] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [archiveCat, setArchiveCat] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    if (!ctx) return;
    setThreads(await getThreads(ctx.coupleId, ctx.myId).catch(() => []));
  }, [ctx]);

  const loadCards = useCallback(async () => {
    if (!ctx) return;
    setCards(null);
    const all = await getCards("questions", category).catch(() => [] as Card[]);
    // shuffle, and skip questions you've already asked each other
    const asked = new Set(threads.map((t) => t.question?.id));
    setCards(all.filter((c) => !asked.has(c.id)).sort(() => Math.random() - 0.5));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, category]);

  useFocusEffect(
    useCallback(() => {
      loadThreads();
    }, [loadThreads]),
  );
  useEffect(() => {
    loadCards();
  }, [loadCards]);

  if (!ctx) {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </ScreenBackground>
    );
  }

  const cats = [...QUESTION_CATEGORIES.map((c) => c.value), ...(ctx.spicy.on ? ["spicy"] : [])];
  const top = cards?.[0] ?? null;

  function skip() {
    setCards((c) => (c ? c.slice(1) : c)); // nothing is recorded
  }

  async function ask(card: Card) {
    if (!ctx) return;
    setAsking(true);
    try {
      const id = await askQuestion(ctx.coupleId, ctx.myId, card.id);
      setCards((c) => (c ? c.slice(1) : c));
      router.push({ pathname: "/play/question/[id]", params: { id } });
    } catch (e: any) {
      Alert.alert("Couldn't ask that", e.message ?? String(e));
    } finally {
      setAsking(false);
    }
  }

  const waitingForMe = threads.filter((t) => !t.myAnswer);
  const waitingForThem = threads.filter((t) => t.myAnswer && !t.theirAnswer);
  const revealed = threads.filter((t) => t.myAnswer && t.theirAnswer);
  const archive = revealed.filter((t) => !archiveCat || t.question?.category === archiveCat);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <ScreenBackground padded={false}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
          <BackButton />
          <Title variant="titleItalic" style={styles.title}>
            Questions
          </Title>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {cats.map((c) => (
              <Chip key={c} label={categoryLabel(c)} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </ScrollView>

          <View style={styles.deckArea}>
            {cards === null ? (
              <ActivityIndicator color={colors.coral} />
            ) : top ? (
              <Deck key={top.id} card={top} next={cards[1] ?? null} onSkip={skip} onAsk={() => ask(top)} />
            ) : (
              <Body color={colors.inkSoft} center>
                You've been through this pile. Try another category, or add your own card.
              </Body>
            )}
          </View>

          {top && (
            <View style={styles.deckButtons}>
              <Button title="Skip" variant="soft" onPress={skip} style={styles.flex} />
              <Button title={`Ask ${ctx.partnerName}`} onPress={() => ask(top)} loading={asking} style={styles.flex} />
            </View>
          )}
          <Button title="Add your own card" variant="text" onPress={() => setAddOpen(true)} />

          <ThreadList title="Waiting for you" threads={waitingForMe} partnerName={ctx.partnerName} myId={ctx.myId} />
          <ThreadList title={`Waiting for ${ctx.partnerName}`} threads={waitingForThem} partnerName={ctx.partnerName} myId={ctx.myId} />

          {revealed.length > 0 && (
            <View style={styles.section}>
              <Title variant="headingItalic">Our answers</Title>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Chip label="All" selected={!archiveCat} onPress={() => setArchiveCat(null)} />
                {[...new Set(revealed.map((t) => t.question!.category))].map((c) => (
                  <Chip key={c} label={categoryLabel(c)} selected={archiveCat === c} onPress={() => setArchiveCat(c)} />
                ))}
              </ScrollView>
              {archive.map((t) => (
                <ThreadRow key={t.id} thread={t} status="Revealed" />
              ))}
            </View>
          )}
        </ScrollView>

        <AddCardSheet
          visible={addOpen}
          onClose={() => setAddOpen(false)}
          onAdded={loadCards}
          table="questions"
          categories={QUESTION_CATEGORIES.map((c) => c.value)}
          spicyOn={ctx.spicy.on}
          coupleId={ctx.coupleId}
          myId={ctx.myId}
          title="Add a question"
        />
      </ScreenBackground>
    </GestureHandlerRootView>
  );
}

// The top card follows your finger; release far enough left to skip or right to ask.
function Deck({ card, next, onSkip, onAsk }: { card: Card; next: Card | null; onSkip: () => void; onAsk: () => void }) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const threshold = width * 0.28;

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      x.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX > threshold) {
        x.value = withTiming(width, { duration: reduceMotion ? 0 : 220 }, () => scheduleOnRN(onAsk));
      } else if (e.translationX < -threshold) {
        x.value = withTiming(-width, { duration: reduceMotion ? 0 : 220 }, () => scheduleOnRN(onSkip));
      } else {
        x.value = withSpring(0);
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { rotate: `${(x.value / width) * 14}deg` }],
  }));
  const hintAsk = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, x.value / threshold)) }));
  const hintSkip = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, -x.value / threshold)) }));

  return (
    <View style={styles.deck}>
      {next && <QuestionCard card={next} style={styles.nextCard} />}
      <GestureDetector gesture={pan}>
        <Animated.View style={style}>
          <QuestionCard card={card} />
          <Animated.View style={[styles.hint, styles.hintAsk, hintAsk]} pointerEvents="none">
            <Text style={[typeScale.button, { color: colors.onDark }]}>Ask</Text>
          </Animated.View>
          <Animated.View style={[styles.hint, styles.hintSkip, hintSkip]} pointerEvents="none">
            <Text style={[typeScale.button, { color: colors.inkOcean }]}>Skip</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function QuestionCard({ card, style }: { card: Card; style?: object }) {
  return (
    <View style={[styles.card, { transform: [{ rotate: `${seededTilt(card.id, 2)}deg` }] }, style]}>
      <Body variant="label" color={card.category === "spicy" ? colors.sunset : colors.ocean}>
        {categoryLabel(card.category)}
        {card.couple_id ? "  ·  ours" : ""}
      </Body>
      <Title variant="heading" style={styles.cardText}>
        {card.text}
      </Title>
    </View>
  );
}

function ThreadList({ title, threads, partnerName, myId }: { title: string; threads: Thread[]; partnerName: string; myId: string }) {
  if (threads.length === 0) return null;
  return (
    <View style={styles.section}>
      <Body variant="label" color={colors.inkSoft}>
        {title}
      </Body>
      {threads.map((t) => (
        <ThreadRow
          key={t.id}
          thread={t}
          status={!t.myAnswer ? (t.asked_by !== myId ? `${partnerName} asked you` : "Answer yours") : `Waiting for ${partnerName}`}
        />
      ))}
    </View>
  );
}

function ThreadRow({ thread, status }: { thread: Thread; status: string }) {
  const spicy = thread.question?.category === "spicy";
  return (
    <PressableScale
      onPress={() => router.push({ pathname: "/play/question/[id]", params: { id: thread.id } })}
      accessibilityRole="button"
      style={styles.threadRow}
    >
      <View style={styles.flex}>
        {/* spicy questions stay neutral in lists until opened */}
        <Handwritten variant="handSmall" numberOfLines={2}>
          {spicy ? SPICY_TEASER : thread.question?.text}
        </Handwritten>
        <Body variant="small" color={colors.inkSoft}>
          {status}
        </Body>
      </View>
    </PressableScale>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      haptic={false}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <Text style={[typeScale.small, { color: selected ? colors.onDark : colors.inkOcean }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: GUTTER },
  back: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.warmWhite, alignItems: "center", justifyContent: "center", ...shadows.lifted },
  backText: { color: colors.inkOcean, fontSize: 22, lineHeight: 26, fontWeight: "700" },
  title: { marginTop: space.md },
  chips: { gap: space.sm, paddingVertical: space.md },
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, backgroundColor: colors.paperDeep },
  chipOn: { backgroundColor: colors.ocean },
  deckArea: { minHeight: 250, justifyContent: "center", marginTop: space.md },
  deck: { alignItems: "stretch" },
  card: {
    backgroundColor: colors.warmWhite,
    borderRadius: radius.paper,
    padding: space.xl,
    minHeight: 220,
    justifyContent: "center",
    ...shadows.paper,
  },
  nextCard: { position: "absolute", left: 0, right: 0, top: 8, opacity: 0.7, backgroundColor: colors.paper },
  cardText: { marginTop: space.md },
  hint: { position: "absolute", top: space.md, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.badge },
  hintAsk: { left: space.md, backgroundColor: colors.ocean },
  hintSkip: { right: space.md, backgroundColor: colors.sand },
  deckButtons: { flexDirection: "row", gap: space.md, marginTop: space.lg },
  section: { marginTop: space.xxl, gap: space.sm },
  threadRow: { backgroundColor: colors.warmWhite, borderRadius: radius.paper, padding: space.lg, ...shadows.lifted },
});
