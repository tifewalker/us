import { Handwritten, seededTilt, WashiTape } from "@/components/ui";
import { colors, radius, shadows, space } from "@/theme";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { VoicePlayer } from "./VoicePlayer";

// A voice note pinned into a memory: a small paper tag with a strip of tape,
// a Caveat label and the waveform player — never a polaroid. Long-press for
// options (remove).
export function VoiceTag({
  id,
  playKey,
  uri,
  durationSeconds,
  waveform,
  label = "a voice note",
  onLongPress,
  style,
}: {
  id: string;
  playKey: string;
  uri: string | null;
  durationSeconds: number;
  waveform: number[];
  label?: string;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const tilt = seededTilt(id, 2);
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityLabel={`Voice note${onLongPress ? ". Long-press for options" : ""}`}
      style={[styles.tag, { transform: [{ rotate: `${tilt}deg` }] }, style]}
    >
      <WashiTape color="sky" width={52} rotate={-tilt * 2} style={styles.tape} />
      <Handwritten variant="handSmall" color={colors.inkSoft}>
        {label}
      </Handwritten>
      <VoicePlayer playKey={playKey} uri={uri} durationSeconds={durationSeconds} waveform={waveform} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tag: {
    backgroundColor: colors.warmWhite,
    borderRadius: radius.paper,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
    ...shadows.paper,
  },
  tape: { position: "absolute", top: -9, alignSelf: "center" },
});
