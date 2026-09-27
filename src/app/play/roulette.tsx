import { AddCardSheet } from "@/components/play/AddCardSheet";
import { BackButton } from "@/components/play/BackButton";
import { usePlayContext } from "@/components/play/usePlayContext";
import { Body, Button, Handwritten, PressableScale, ScreenBackground, successHaptic, tapHaptic, Title } from "@/components/ui";
import {
    categoryLabel,
    getCards,
    getRecentSpins,
    markSpinDone,
    recordSpin,
    ROULETTE_MOODS,
    SPICY_TEASER,
    type Card,
    type Spin,
} from "@/lib/play";
import { colors, GUTTER, radius, scene, shadows, space, type as typeScale } from "@/theme";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
    Easing,
    FadeIn,
    useAnimatedReaction,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";

const SEGMENTS = 8;
// Each slice shows the current mood's emoji instead of a number.
const MOOD_EMOJI: Record<string, string> = { easy: "🌊", romantic: "💕", funny: "😂", chaotic: "🌀", hard: "🔥", spicy: "🌶️" };
const SEG_COLORS = [colors.coral, colors.sand, colors.sky, colors.sunset, scene.palmLeaf, colors.warmWhite, "#BFE3F0", "#FFB4A8"];
const SPIN_MS = 3800;

// Roulette: pick a mood, spin the wheel (realistic deceleration; a haptic tick
// per segment on native), land on a challenge card. Reduce Motion: no spin.
export default function Roulette() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { ctx } = usePlayContext();
  const [mood, setMood] = useState<string>("easy");
  const [pool, setPool] = useState<Card[] | null>(null);
  const [landed, setLanded] = useState<{ card: Card; spin: Spin | null } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [recent, setRecent] = useState<Spin[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const rotation = useSharedValue(0);
  const size = Math.min(width - GUTTER * 2, 320);

  const loadRecent = useCallback(async () => {
    if (!ctx) return;
    const spins = await getRecentSpins(ctx.coupleId).catch(() => [] as Spin[]);
    setRecent(spins.filter((s) => ctx.spicy.on || s.mood !== "spicy"));
  }, [ctx]);

  const loadPool = useCallback(async () => {
    if (!ctx) return;
    setPool(null);
    setLanded(null);
    const cards = await getCards("roulette_challenges", mood).catch(() => [] as Card[]);
    setPool(cards.sort(() => Math.random() - 0.5));
  }, [ctx, mood]);

  useFocusEffect(
    useCallback(() => {
      loadRecent();
    }, [loadRecent]),
  );
  useEffect(() => {
    loadPool();
  }, [loadPool]);

  // up to 8 challenges on the wheel
  const wheel = useMemo(() => (pool ?? []).slice(0, SEGMENTS), [pool]);
  const segs = Math.max(wheel.length, 1);

  // haptic tick each time a segment passes the pointer (native only)
  useAnimatedReaction(
    () => Math.floor((((rotation.value % 360) + 360) % 360) / (360 / segs)),
    (cur, prev) => {
      if (prev !== null && cur !== prev && Platform.OS !== "web") scheduleOnRN(tapHaptic);
    },
  );
  const wheelStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  if (!ctx) {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <ActivityIndicator color={colors.coral} />
        </View>
      </ScreenBackground>
    );
  }

  const moods = [...ROULETTE_MOODS, ...(ctx.spicy.on ? ["spicy"] : [])];

  async function onLanded(card: Card) {
    if (!ctx) return;
    successHaptic();
    // Spicy spins are only saved when you actually do them — "Skip" leaves no trace.
    if (card.category === "spicy") {
      setLanded({ card, spin: null });
      setSpinning(false);
      return;
    }
    try {
      const spin = await recordSpin(ctx.coupleId, ctx.myId, card, mood);
      setLanded({ card, spin });
      loadRecent();
    } catch (e: any) {
      setLanded({ card, spin: null });
      Alert.alert("Couldn't save the spin", e.message ?? String(e));
    } finally {
      setSpinning(false);
    }
  }

  function spin() {
    if (spinning || wheel.length === 0) return;
    setLanded(null);
    setSpinning(true);
    const target = Math.floor(Math.random() * wheel.length);
    const segAngle = 360 / wheel.length;
    // pointer is at the top: bring the middle of `target` to 0°
    const current = ((rotation.value % 360) + 360) % 360;
    const toCentre = 360 - (target * segAngle + segAngle / 2);
    const delta = (toCentre - current + 360) % 360;
    if (reduceMotion) {
      rotation.value = rotation.value + delta;
      onLanded(wheel[target]);
      return;
    }
    rotation.value = withTiming(rotation.value + 360 * 5 + delta, { duration: SPIN_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) scheduleOnRN(onLanded, wheel[target]);
    });
  }

  async function markDone() {
    if (!landed || !ctx) return;
    try {
      const spin = landed.spin ?? (await recordSpin(ctx.coupleId, ctx.myId, landed.card, mood));
      await markSpinDone(spin.id);
      successHaptic();
      setLanded({ ...landed, spin: { ...spin, done_at: new Date().toISOString() } });
      loadRecent();
    } catch (e: any) {
      Alert.alert("Couldn't save", e.message ?? String(e));
    }
  }

  const r = size / 2 - 8;
  const c = size / 2;
  const segAngle = (Math.PI * 2) / segs;

  return (
    <ScreenBackground padded={false}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
        <BackButton />
        <Title variant="titleItalic" style={styles.title}>
          Roulette
        </Title>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {moods.map((m) => (
            <PressableScale key={m} onPress={() => !spinning && setMood(m)} accessibilityRole="radio" accessibilityState={{ selected: mood === m }} style={[styles.chip, mood === m && styles.chipOn]}>
              <Text style={[typeScale.small, { color: mood === m ? colors.onDark : colors.inkOcean }]}>{categoryLabel(m)}</Text>
            </PressableScale>
          ))}
        </ScrollView>

        <View style={[styles.wheelWrap, { width: size, height: size + 16 }]}>
          {pool === null ? (
            <ActivityIndicator color={colors.coral} />
          ) : (
            <>
              <Animated.View style={[{ width: size, height: size, marginTop: 16 }, wheelStyle]}>
                <Svg width={size} height={size}>
                  <Circle cx={c} cy={c} r={r + 6} fill={scene.woodDark} />
                  {Array.from({ length: segs }, (_, i) => {
                    // segment i spans clockwise from -90° (top)
                    const a0 = i * segAngle - Math.PI / 2;
                    const a1 = (i + 1) * segAngle - Math.PI / 2;
                    const p = (a: number) => `${c + r * Math.cos(a)} ${c + r * Math.sin(a)}`;
                    const mid = (a0 + a1) / 2;
                    return (
                      <G key={i}>
                        <Path d={`M${c} ${c} L${p(a0)} A${r} ${r} 0 0 1 ${p(a1)} Z`} fill={SEG_COLORS[i % SEG_COLORS.length]} stroke={colors.warmWhite} strokeWidth={2} />
                        <SvgText x={c + r * 0.66 * Math.cos(mid)} y={c + r * 0.66 * Math.sin(mid) + 8} fontSize={22} textAnchor="middle">
                          {MOOD_EMOJI[mood] ?? "✨"}
                        </SvgText>
                      </G>
                    );
                  })}
                  <Circle cx={c} cy={c} r={16} fill={colors.warmWhite} stroke={scene.woodDark} strokeWidth={3} />
                </Svg>
              </Animated.View>
              {/* pointer */}
              <View style={[styles.pointer, { left: size / 2 - 12 }]}>
                <Svg width={24} height={28}>
                  <Path d="M12 28 L0 0 L24 0 Z" fill={colors.inkOcean} />
                </Svg>
              </View>
            </>
          )}
        </View>

        <Button title={spinning ? "Spinning…" : "Spin"} onPress={spin} disabled={spinning || wheel.length === 0} style={styles.spinBtn} />

        {landed && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.card}>
            <Body variant="label" color={landed.card.category === "spicy" ? colors.sunset : colors.ocean}>
              {categoryLabel(landed.card.category)}
              {landed.card.couple_id ? "  ·  ours" : ""}
            </Body>
            <Title variant="heading" style={styles.cardText}>
              {landed.card.text}
            </Title>
            <View style={styles.row}>
              {landed.spin?.done_at ? (
                <Body color={colors.inkOcean}>Done ✅</Body>
              ) : (
                <Button title="We did it ✅" onPress={markDone} style={styles.flex} />
              )}
              <Button title={landed.card.category === "spicy" ? "Skip" : "Spin again"} variant="soft" onPress={spin} style={styles.flex} />
            </View>
          </Animated.View>
        )}

        <Button title="Add your own challenge" variant="text" onPress={() => setAddOpen(true)} />

        {recent.length > 0 && (
          <View style={styles.section}>
            <Title variant="headingItalic">Recent spins</Title>
            {recent.map((s) => (
              <SpinRow key={s.id} spin={s} name={s.spun_by === ctx.myId ? "You" : ctx.partnerName} onDone={loadRecent} />
            ))}
          </View>
        )}
      </ScrollView>

      <AddCardSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={loadPool}
        table="roulette_challenges"
        categories={ROULETTE_MOODS}
        spicyOn={ctx.spicy.on}
        coupleId={ctx.coupleId}
        myId={ctx.myId}
        title="Add a challenge"
      />
    </ScreenBackground>
  );
}

function SpinRow({ spin, name, onDone }: { spin: Spin; name: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const spicy = spin.mood === "spicy";
  return (
    <PressableScale onPress={() => setOpen((o) => !o)} accessibilityRole="button" style={styles.spinRow}>
      <View style={styles.flex}>
        <Body variant="small" color={colors.inkSoft}>
          {name} spun · {spin.done_at ? "done ✅" : "not yet"}
        </Body>
        <Handwritten variant="handSmall" numberOfLines={open ? undefined : 2}>
          {spicy && !open ? SPICY_TEASER : spin.challenge_text}
        </Handwritten>
      </View>
      {!spin.done_at && (
        <Button
          title="Done"
          variant="text"
          onPress={async () => {
            await markSpinDone(spin.id).catch(() => {});
            onDone();
          }}
        />
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: GUTTER },
  title: { marginTop: space.md },
  chips: { gap: space.sm, paddingVertical: space.md },
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs + 2, borderRadius: radius.pill, backgroundColor: colors.paperDeep },
  chipOn: { backgroundColor: colors.ocean },
  wheelWrap: { alignSelf: "center", alignItems: "center", justifyContent: "center", marginTop: space.md },
  pointer: { position: "absolute", top: 0 },
  spinBtn: { marginTop: space.lg, alignSelf: "center", minWidth: 200 },
  card: { backgroundColor: colors.warmWhite, borderRadius: radius.paper, padding: space.xl, marginTop: space.xl, gap: space.sm, ...shadows.paper },
  cardText: { marginTop: space.xs },
  row: { flexDirection: "row", gap: space.md, marginTop: space.md, alignItems: "center" },
  section: { marginTop: space.xxl, gap: space.sm },
  spinRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.warmWhite, borderRadius: radius.paper, padding: space.lg, ...shadows.lifted },
});
