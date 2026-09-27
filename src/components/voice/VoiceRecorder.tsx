import { Body, Button, Handwritten, PressableScale, successHaptic } from "@/components/ui";
import { DENIED_MESSAGE, formatDuration, UNSUPPORTED_MESSAGE, type LocalVoice } from "@/lib/voice";
import { colors, radius, shadows, space } from "@/theme";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useVoiceRecording } from "./useVoiceRecording";
import { VoicePlayer } from "./VoicePlayer";

type Phase = "idle" | "ask" | "recording" | "preview" | "denied" | "error";

// Paper note with a mic: tap to start, tap to stop (auto-stops at maxSeconds).
// Live level bars + timer while recording, then a preview with "Record again"
// and "Use this". The first time, a friendly note explains why the mic is
// needed before the system prompt appears.
export function VoiceRecorder({
  maxSeconds,
  label = "Record a voice note",
  onUse,
  onCancel,
  style,
}: {
  maxSeconds: number;
  label?: string;
  onUse: (voice: LocalVoice) => void;
  onCancel?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [take, setTake] = useState<LocalVoice | null>(null);
  const rec = useVoiceRecording(maxSeconds, (v) => {
    successHaptic();
    setTake(v);
    setPhase("preview");
  });

  // Web: no pre-prompt note (the mic has to start from the tap itself), so a
  // line under the mic explains the browser's question instead.
  const [webFirstTime, setWebFirstTime] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") rec.checkPermission().then((p) => setWebFirstTime(p === "undetermined"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function begin() {
    const r = await rec.start();
    if (r === "ok") setPhase("recording");
    else if (r === "denied") setPhase("denied");
    else setPhase("error");
  }

  async function onMic() {
    if (rec.recording) {
      await rec.stop();
      return;
    }
    // iOS Safari only lets the mic start from the tap itself, so on web ask
    // straight away; the note below explains it the first time on native.
    if (Platform.OS !== "web" && (await rec.checkPermission()) === "undetermined") {
      setPhase("ask");
      return;
    }
    await begin();
  }

  if (!rec.supported) {
    return (
      <View style={[styles.note, style]}>
        <Handwritten variant="handSmall">{label}</Handwritten>
        <Body color={colors.inkSoft}>{UNSUPPORTED_MESSAGE}</Body>
        {onCancel && <Button title="Never mind" variant="text" onPress={onCancel} />}
      </View>
    );
  }

  return (
    <View style={[styles.note, style]}>
      <Handwritten variant="handSmall">{phase === "preview" ? "Have a listen" : label}</Handwritten>

      {phase === "ask" && (
        <View style={styles.block}>
          <Body color={colors.inkSoft}>
            To record, Us needs your microphone. It only records while you're holding the note open, and only the two of you ever hear it.
          </Body>
          <Button title="Allow microphone" onPress={begin} />
          <Button title="Not now" variant="text" onPress={() => (onCancel ? onCancel() : setPhase("idle"))} />
        </View>
      )}

      {phase === "denied" && (
        <View style={styles.block}>
          <Body color={colors.inkSoft}>{DENIED_MESSAGE}</Body>
          <Button title="Try again" variant="soft" onPress={begin} />
          {onCancel && <Button title="Never mind" variant="text" onPress={onCancel} />}
        </View>
      )}

      {phase === "error" && (
        <View style={styles.block}>
          <Body color={colors.inkSoft}>The microphone didn't start. Close anything else using it and try again.</Body>
          <Button title="Try again" variant="soft" onPress={begin} />
          {onCancel && <Button title="Never mind" variant="text" onPress={onCancel} />}
        </View>
      )}

      {(phase === "idle" || phase === "recording") && (
        <View style={styles.block}>
          <View style={styles.micRow}>
            <PressableScale
              onPress={onMic}
              accessibilityRole="button"
              accessibilityLabel={rec.recording ? "Stop recording" : "Start recording"}
              style={[styles.mic, rec.recording && styles.micOn]}
            >
              <Svg width={26} height={26} viewBox="0 0 26 26">
                {rec.recording ? (
                  <Rect x={7} y={7} width={12} height={12} rx={2} fill={colors.warmWhite} />
                ) : (
                  <>
                    <Rect x={9} y={3} width={8} height={13} rx={4} fill={colors.warmWhite} />
                    <Path d="M6 12 a7 7 0 0 0 14 0 M13 19 V23" stroke={colors.warmWhite} strokeWidth={2} fill="none" strokeLinecap="round" />
                  </>
                )}
              </Svg>
            </PressableScale>
            {rec.recording ? (
              <View style={styles.meter}>
                {Array.from({ length: 32 }, (_, i) => {
                  const l = rec.liveLevels[rec.liveLevels.length - 32 + i] ?? 0;
                  return <View key={i} style={[styles.meterBar, { height: 4 + l * 32 }]} />;
                })}
              </View>
            ) : (
              <Body color={colors.inkSoft} style={styles.flex}>
                Tap to record · up to {maxSeconds >= 120 ? "2 minutes" : maxSeconds >= 60 ? "1 minute" : `${maxSeconds}s`}
              </Body>
            )}
          </View>
          {rec.recording && (
            <View style={styles.timerRow}>
              <Svg width={10} height={10}>
                <Circle cx={5} cy={5} r={5} fill={colors.sunset} />
              </Svg>
              <Body variant="small" color={colors.inkSoft} style={styles.tabular}>
                {formatDuration(rec.elapsedMs / 1000)} / {formatDuration(maxSeconds)}
              </Body>
            </View>
          )}
          {!rec.recording && webFirstTime && (
            <Body variant="small" color={colors.inkFaint}>
              Your browser will ask to use the microphone. Only the two of you ever hear it.
            </Body>
          )}
          {!rec.recording && onCancel && <Button title="Never mind" variant="text" onPress={onCancel} />}
        </View>
      )}

      {phase === "preview" && take && (
        <View style={styles.block}>
          <VoicePlayer playKey={take.uri} uri={take.uri} durationSeconds={take.durationMs / 1000} waveform={take.waveform} />
          <View style={styles.actions}>
            <Button
              title="Record again"
              variant="soft"
              style={styles.flex}
              onPress={() => {
                setTake(null);
                setPhase("idle");
              }}
            />
            <Button title="Use this" style={styles.flex} onPress={() => onUse(take)} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { backgroundColor: colors.warmWhite, borderRadius: radius.paper, padding: space.lg, gap: space.sm, ...shadows.paper },
  block: { gap: space.md },
  micRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  mic: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.ocean, alignItems: "center", justifyContent: "center", ...shadows.lifted },
  micOn: { backgroundColor: colors.sunset },
  meter: { flex: 1, height: 40, flexDirection: "row", alignItems: "center", gap: 2 },
  meterBar: { flex: 1, borderRadius: 2, backgroundColor: colors.sunset },
  timerRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  tabular: { fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", gap: space.md },
  flex: { flex: 1 },
});
