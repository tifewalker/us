import { Button, Handwritten, successHaptic, tapHaptic, Title } from "@/components/ui";
import type { Song } from "@/lib/music";
import { colors, radius, shadows, space, type as typeScale } from "@/theme";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
    Easing,
    FadeIn,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withTiming,
    type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { FloatingHearts } from "./effects";

export type RevealAnswer = { text: string | null; song: Song | null; imageUrl: string | null };

// Timeline (ms): my flap → my card slides out & flips → their flap → their card → hearts.
const T = { flapA: 0, cardA: 380, flapB: 900, cardB: 1280, hearts: 2050, done: 3900 };
const FLAP_MS = 520;
const CARD_MS = 780;

// The reveal: two sealed envelopes (yours and theirs). "Open together" (or tap
// an envelope) opens them one after the other; the answers slide out as paper
// cards with a 3D flip, then coral hearts float up. Tap during it to skip.
// Reduce Motion: the open cards fade in, no hearts.
export function EnvelopeReveal({
  myName,
  partnerName,
  mine,
  theirs,
  matching,
  autoOpen = false,
  onDone,
}: {
  myName: string;
  partnerName: string;
  mine: RevealAnswer;
  theirs: RevealAnswer;
  matching: boolean;
  autoOpen?: boolean;
  onDone: () => void;
}) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const envW = Math.min((width - space.xl * 2 - space.lg) / 2, 180);
  const envH = envW * 0.72;

  const flapA = useSharedValue(0);
  const cardA = useSharedValue(0);
  const flapB = useSharedValue(0);
  const cardB = useSharedValue(0);
  const [phase, setPhase] = useState<"sealed" | "opening" | "open">("sealed");
  const [hearts, setHearts] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const finishNow = () => {
    timers.current.forEach(clearTimeout);
    flapA.value = 1;
    cardA.value = 1;
    flapB.value = 1;
    cardB.value = 1;
    setPhase("open");
    successHaptic();
    timers.current = [setTimeout(onDone, reduceMotion ? 900 : 700)];
  };

  const open = () => {
    if (phase !== "sealed") return;
    if (reduceMotion) return finishNow();
    setPhase("opening");
    const ease = Easing.out(Easing.cubic);
    flapA.value = withDelay(T.flapA, withTiming(1, { duration: FLAP_MS, easing: ease }));
    cardA.value = withDelay(T.cardA, withTiming(1, { duration: CARD_MS, easing: ease }));
    flapB.value = withDelay(T.flapB, withTiming(1, { duration: FLAP_MS, easing: ease }));
    cardB.value = withDelay(T.cardB, withTiming(1, { duration: CARD_MS, easing: ease }));
    tapHaptic();
    timers.current = [
      setTimeout(tapHaptic, T.flapB),
      setTimeout(() => {
        setHearts(true);
        setPhase("open");
        successHaptic();
      }, T.hearts),
      setTimeout(onDone, T.done),
    ];
  };

  useEffect(() => {
    if (autoOpen) {
      const t = setTimeout(open, 500);
      timers.current.push(t);
    }
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.root}>
      <Pressable onPress={phase === "opening" ? finishNow : open} accessibilityRole="button" accessibilityLabel={phase === "sealed" ? "Open together" : "Skip"}>
        <Title variant="titleItalic" color={colors.coral} center>
          You both answered
        </Title>
        <View style={[styles.row, { marginTop: space.lg + envH * 1.3 }]}>
          <Envelope width={envW} height={envH} label={myName} flap={flapA} card={cardA} answer={mine} tilt={-3} />
          <Envelope width={envW} height={envH} label={partnerName} flap={flapB} card={cardB} answer={theirs} tilt={3} />
        </View>
        {phase === "open" && matching && (
          <Animated.View entering={FadeIn.duration(500)}>
            <Title variant="headingItalic" center style={styles.match}>
              Same brain again 😂❤️
            </Title>
          </Animated.View>
        )}
      </Pressable>

      {phase === "sealed" && (
        <Button title="Open together" icon="loveLetter" onPress={open} style={styles.button} />
      )}

      {hearts && <FloatingHearts width={width - space.xl * 2} height={envH * 3.2} />}
    </Animated.View>
  );
}

function Envelope({
  width,
  height,
  label,
  flap,
  card,
  answer,
  tilt,
}: {
  width: number;
  height: number;
  label: string;
  flap: SharedValue<number>;
  card: SharedValue<number>;
  answer: RevealAnswer;
  tilt: number;
}) {
  const cardH = height * 1.25;
  const flapStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateX: `${-180 * flap.value}deg` }],
    zIndex: flap.value > 0.5 ? 0 : 3,
  }));
  const cardStyle = useAnimatedStyle(() => {
    const slide = Math.min(1, card.value * 1.5);
    const flip = Math.max(0, Math.min(1, (card.value - 0.25) / 0.75));
    return {
      opacity: card.value > 0 ? 1 : 0,
      transform: [
        { perspective: 800 },
        { translateY: -cardH * 0.78 * slide },
        { rotateY: `${90 - 90 * flip}deg` },
      ],
    };
  });

  return (
    <View style={{ width, height, transform: [{ rotate: `${tilt}deg` }] }}>
      {/* the card, tucked inside, slides up and flips to face you */}
      <Animated.View style={[styles.card, { width: width - 16, height: cardH, left: 8, top: height - cardH }, cardStyle]}>
        <AnswerFace answer={answer} />
      </Animated.View>
      {/* envelope body (front pocket) */}
      <View style={[styles.body, { width, height }]}>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Path d={`M0 ${height} L${width / 2} ${height * 0.45} L${width} ${height}`} stroke={colors.paperEdge} strokeWidth={1.5} fill="none" />
        </Svg>
        <Handwritten variant="handSmall" center style={styles.label} numberOfLines={1}>
          {label}
        </Handwritten>
      </View>
      {/* flap, hinged on the top edge */}
      <Animated.View style={[styles.flapWrap, { width, height: height * 0.62, transformOrigin: "50% 0%" }, flapStyle]}>
        <Svg width={width} height={height * 0.62}>
          <Path d={`M0 0 L${width} 0 L${width / 2} ${height * 0.62} Z`} fill={colors.paperDeep} stroke={colors.paperEdge} strokeWidth={1.5} />
        </Svg>
        <View style={[styles.seal, { left: width / 2 - 9, top: height * 0.62 - 20 }]} />
      </Animated.View>
    </View>
  );
}

function AnswerFace({ answer }: { answer: RevealAnswer }) {
  if (answer.song) {
    return (
      <View style={styles.face}>
        {answer.song.artworkUrl ? <Image source={{ uri: answer.song.artworkUrl }} style={styles.art} contentFit="cover" /> : null}
        <Text style={[typeScale.small, styles.songTitle]} numberOfLines={2}>
          {answer.song.title}
        </Text>
      </View>
    );
  }
  if (answer.imageUrl) {
    return <Image source={{ uri: answer.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />;
  }
  return (
    <View style={styles.face}>
      <Handwritten variant="handSmall" center numberOfLines={5}>
        {answer.text ?? "📸"}
      </Handwritten>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: space.xl, paddingBottom: space.lg },
  row: { flexDirection: "row", justifyContent: "center", gap: space.lg },
  body: {
    backgroundColor: colors.paper,
    borderRadius: radius.paper,
    borderWidth: 1.5,
    borderColor: colors.paperEdge,
    justifyContent: "flex-end",
    paddingBottom: space.sm,
    zIndex: 2,
    ...shadows.paper,
  },
  label: { color: colors.inkOcean },
  flapWrap: { position: "absolute", left: 0, top: 0 },
  seal: { position: "absolute", width: 18, height: 18, borderRadius: 9, backgroundColor: colors.coral },
  card: {
    position: "absolute",
    backgroundColor: colors.warmWhite,
    borderRadius: radius.photo,
    padding: space.sm,
    zIndex: 1,
    overflow: "hidden",
    ...shadows.lifted,
  },
  face: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.xs },
  // explicit pixel size (not % width + aspectRatio — see CLAUDE.md gotchas)
  art: { width: 64, height: 64, borderRadius: radius.photo },
  songTitle: { color: colors.ink, textAlign: "center" },
  match: { marginTop: space.xl },
  button: { marginTop: space.xl, alignSelf: "center", minWidth: 200 },
});
