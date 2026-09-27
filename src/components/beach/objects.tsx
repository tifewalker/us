import {
    Handwritten,
    Icon3D,
    Polaroid,
    PressableScale,
    successHaptic,
} from "@/components/ui";
import type { TodaySongStatus } from "@/lib/songs";
import type { TodayStatus } from "@/lib/world";
import { colors, radius, scene, shadows, space, type as typeScale } from "@/theme";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Ellipse, Rect } from "react-native-svg";
import { seededUnit } from "@/components/ui/seeded";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { ShellShape } from "./Decor";
import { useLoop } from "./useLoop";

// ---- Wooden sign ---------------------------------------------------------

export function WoodenSign({
  x,
  baseY,
  width,
  daysOfUs,
  countdown,
  onPress,
  onLongPress,
}: {
  x: number;
  baseY: number;
  width: number;
  daysOfUs: number;
  countdown: string; // nearest upcoming date — see lib/importantDates signCountdown()
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const POST = 44;

  return (
    <View pointerEvents="box-none" style={[styles.abs, { left: x - width / 2, width, top: baseY - 132 }]}>
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={600}
        accessibilityRole="button"
        accessibilityLabel={`${daysOfUs} days of us. ${countdown}`}
        style={[styles.signWrap, { transform: [{ rotate: "-3deg" }] }]}
      >
        <View style={[styles.plank, { width }]}>
          {/* wood grain */}
          <View style={[styles.grain, { top: 14, left: 10, right: 30 }]} />
          <View style={[styles.grain, { top: 44, left: 26, right: 12 }]} />
          <View style={[styles.nail, { left: 8 }]} />
          <View style={[styles.nail, { right: 8 }]} />
          <Text style={[typeScale.heading, styles.signTitle]} numberOfLines={1} adjustsFontSizeToFit>
            {daysOfUs} days of us
          </Text>
          <Text style={[typeScale.small, styles.signSub]} numberOfLines={2}>
            {countdown}
          </Text>
        </View>
        <View style={[styles.post, { height: POST }]} />
        {/* sand mound where the post goes in */}
        <Svg width={60} height={12} style={styles.mound}>
          <Ellipse cx={30} cy={8} rx={28} ry={6} fill={scene.sandShadow} />
        </Svg>
      </PressableScale>
    </View>
  );
}

// ---- Polaroid stuck in the sand -------------------------------------------

export function SandPolaroid({
  x,
  top,
  width,
  memory,
  onPress,
}: {
  x: number;
  top: number;
  width: number;
  memory: { id: string; title: string; imageUrl: string | null; imagePath?: string | null } | null;
  onPress: () => void;
}) {
  return (
    <View pointerEvents="box-none" style={[styles.abs, { left: x - width / 2, top }]}>
      {memory ? (
        <Polaroid
          seed={memory.id}
          uri={memory.imageUrl}
          cacheKey={memory.imagePath}
          width={width}
          caption={memory.title}
          tape="sky"
          onPress={onPress}
          accessibilityLabel={`Latest memory: ${memory.title}`}
        />
      ) : (
        <Polaroid
          seed="first-memory"
          width={width}
          caption="Add our first memory"
          onPress={onPress}
          accessibilityLabel="Add our first memory"
        >
          <View style={styles.emptyPhoto}>
            <Icon3D name="camera" size={width * 0.34} />
          </View>
        </Polaroid>
      )}
      <Svg width={width + 20} height={14} style={styles.polaroidMound} pointerEvents="none">
        <Ellipse cx={(width + 20) / 2} cy={9} rx={(width + 20) / 2 - 4} ry={6} fill={scene.sand} />
      </Svg>
    </View>
  );
}

// ---- Today's moment: folded note pinned to the palm ------------------------

const TODAY_COPY: Record<TodayStatus, string> = {
  noPartner: "This opens once your partner joins 🌊",
  fresh: "Something's waiting for you",
  yourTurn: "Your partner answered — your turn 👀",
  waiting: "Waiting for your partner",
  revealed: "Revealed ❤️",
};

export function TodayNote({
  status,
  onPress,
  style,
}: {
  status: TodayStatus;
  onPress: () => void;
  style?: object;
}) {
  const disabled = status === "noPartner";
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Today's moment. ${TODAY_COPY[status]}`}
      style={[styles.note, status === "yourTurn" && styles.noteHighlight, style]}
    >
      {/* folded corner + pin */}
      <View style={styles.fold} />
      <View style={styles.pin} />
      <Text style={[typeScale.small, styles.noteLabel]}>Today's moment</Text>
      <Handwritten variant="handSmall" style={styles.noteText}>
        {TODAY_COPY[status]}
      </Handwritten>
    </PressableScale>
  );
}

// ---- Shells along the shore ------------------------------------------------

export function Shells({
  count,
  colorful,
  W,
  shoreY,
  band,
  onPress,
}: {
  count: number;
  colorful: boolean;
  W: number;
  shoreY: number;
  band: number;
  onPress: () => void;
}) {
  const n = Math.min(count, 12);
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const seed = `shell-${i}`;
        // spread evenly along the shore, jittered, in the wet band
        const x = W * (0.06 + (0.88 * (i + 0.5)) / Math.max(n, 1)) + (seededUnit(seed, 1) - 0.5) * 18;
        const y = shoreY + 6 + seededUnit(seed, 2) * band * 0.12;
        const color = colorful ? scene.shells[i % scene.shells.length] : scene.shellPlain;
        const rotate = (seededUnit(seed, 3) - 0.5) * 60;
        return (
          <PressableScale
            key={i}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel="Shell — open your story"
            hitSlop={8}
            style={[styles.abs, { left: x - 12, top: y, transform: [{ rotate: `${rotate}deg` }] }]}
          >
            <ShellShape color={color} size={20 + seededUnit(seed, 4) * 6} />
          </PressableScale>
        );
      })}
    </>
  );
}

// ---- Camera sticker on a beach towel ---------------------------------------

export function CameraTowel({ left, top, width, onPress }: { left: number; top: number; width: number; onPress: () => void }) {
  const h = 56;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add a memory"
      style={[styles.abs, { left, top, width, height: h, transform: [{ rotate: "-5deg" }] }]}
    >
      <Svg width={width} height={h} style={StyleSheet.absoluteFill}>
        <Rect x={3} y={4} width={width - 4} height={h - 4} rx={4} fill="#000" opacity={0.12} />
        <Rect x={0} y={0} width={width - 4} height={h - 4} rx={4} fill={scene.towelB} />
        {Array.from({ length: 5 }, (_, i) => (
          <Rect key={i} x={((width - 4) / 5) * i} y={0} width={(width - 4) / 10} height={h - 4} fill={scene.towelA} opacity={0.85} />
        ))}
      </Svg>
      <View style={styles.towelContent}>
        <Icon3D name="camera" size={40} style={{ transform: [{ rotate: "8deg" }] }} />
        <View style={styles.towelLabel}>
          <Text style={[typeScale.small, styles.towelText]}>Add a memory</Text>
        </View>
      </View>
    </PressableScale>
  );
}

// ---- Radio sticker: our song today -----------------------------------------

export function RadioSticker({
  left,
  top,
  maxWidth,
  status,
  partnerName,
  onPress,
}: {
  left: number;
  top: number;
  maxWidth: number;
  status: TodaySongStatus;
  partnerName: string | null;
  onPress: () => void;
}) {
  const copy: Record<TodaySongStatus, string> = {
    noPartner: "This opens once your partner joins 🌊",
    none: "Pick today's song",
    partnerPicked: `${partnerName ?? "Your partner"} picked a song for you 🎧`,
    youPicked: "You picked today's song",
    bothListened: "You both listened ❤️",
  };
  return (
    <PressableScale
      onPress={onPress}
      disabled={status === "noPartner"}
      accessibilityRole="button"
      accessibilityLabel={`Our song today. ${copy[status]}`}
      style={[styles.abs, styles.radioRow, { left, top, maxWidth }]}
    >
      <Icon3D name="radio" size={46} style={{ transform: [{ rotate: "-6deg" }] }} />
      <View style={[styles.radioBubble, status === "partnerPicked" && styles.radioBubbleHot]}>
        <Text style={[typeScale.small, styles.radioText]} numberOfLines={2}>
          {copy[status]}
        </Text>
      </View>
    </PressableScale>
  );
}

// ---- Message in a bottle (waiting for partner) -----------------------------

export function MessageBottle({
  left,
  top,
  maxWidth,
  code,
  active,
}: {
  left: number;
  top: number;
  maxWidth: number;
  code: string;
  active: boolean;
}) {
  const [copied, setCopied] = useState(false);
  // Bobs gently on the waterline (still when not animating / Reduce Motion).
  const bob = useLoop(2600, active, { reverse: true });
  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (bob.value - 0.5) * 6 }, { rotate: `${-35 + (bob.value - 0.5) * 8}deg` }],
  }));
  async function copy() {
    await Clipboard.setStringAsync(code);
    successHaptic();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <View pointerEvents="box-none" style={[styles.abs, styles.bottleRow, { left, top, maxWidth }]}>
      <Animated.View style={bobStyle}>
        <Icon3D name="bottle" size={52} />
      </Animated.View>
      <PressableScale
        onPress={copy}
        accessibilityRole="button"
        accessibilityLabel={`Invite code ${code}. Tap to copy`}
        style={styles.bottleTag}
      >
        <Text style={[typeScale.small, styles.bottleHint]}>Waiting for your partner to join</Text>
        <Text selectable style={[typeScale.bodyStrong, styles.bottleCode]} numberOfLines={1} adjustsFontSizeToFit>
          {code}
        </Text>
        <Text style={[typeScale.small, styles.bottleCopy]}>{copied ? "Copied ✨" : "Tap to copy"}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },

  signWrap: { alignItems: "center" },
  plank: {
    backgroundColor: scene.wood,
    borderRadius: radius.paper,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minHeight: 78,
    justifyContent: "center",
    ...shadows.paper,
  },
  grain: { position: "absolute", height: 1.5, backgroundColor: scene.woodDark, opacity: 0.25, borderRadius: 1 },
  nail: { position: "absolute", top: 8, width: 5, height: 5, borderRadius: 3, backgroundColor: scene.woodDark, opacity: 0.6 },
  signTitle: { color: colors.warmWhite, textAlign: "center" },
  signSub: { color: colors.warmWhite, textAlign: "center", opacity: 0.9, marginTop: 2 },
  post: { width: 10, backgroundColor: scene.woodDark, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  mound: { marginTop: -8 },

  emptyPhoto: { flex: 1, alignItems: "center", justifyContent: "center" },
  polaroidMound: { position: "absolute", bottom: -6, left: -10 },

  note: {
    width: 128,
    backgroundColor: colors.warmWhite,
    borderRadius: 3,
    paddingTop: space.md,
    paddingBottom: space.sm,
    paddingHorizontal: space.sm,
    transform: [{ rotate: "4deg" }],
    ...shadows.paper,
  },
  noteHighlight: { backgroundColor: colors.sand },
  fold: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    borderStyle: "solid",
    borderRightWidth: 16,
    borderTopWidth: 16,
    borderRightColor: "transparent",
    borderTopColor: colors.paperEdge,
  },
  pin: {
    position: "absolute",
    top: -5,
    alignSelf: "center",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.sunset,
    ...shadows.lifted,
  },
  noteLabel: { color: colors.inkSoft, fontSize: 11, lineHeight: 14 },
  noteText: { color: colors.ink, marginTop: 2 },

  towelContent: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm, gap: space.xs },
  towelLabel: { backgroundColor: "rgba(255,248,239,0.9)", borderRadius: radius.badge, paddingHorizontal: 6, paddingVertical: 2 },
  towelText: { color: colors.inkOcean },

  bottleRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  radioBubble: {
    flexShrink: 1,
    backgroundColor: colors.warmWhite,
    borderRadius: radius.badge,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    transform: [{ rotate: "2deg" }],
    ...shadows.lifted,
  },
  radioBubbleHot: { backgroundColor: colors.sand },
  radioText: { color: colors.inkOcean, fontSize: 12, lineHeight: 16 },
  bottleTag: {
    flexShrink: 1,
    backgroundColor: colors.warmWhite,
    borderRadius: radius.ticket,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    transform: [{ rotate: "-2deg" }],
    ...shadows.paper,
  },
  bottleHint: { color: colors.inkSoft, fontSize: 11, lineHeight: 14 },
  bottleCode: { color: colors.inkOcean },
  bottleCopy: { color: colors.ocean, fontSize: 11, lineHeight: 14 },
});
