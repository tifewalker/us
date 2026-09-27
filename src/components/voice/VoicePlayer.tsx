import { Body } from "@/components/ui";
import { seekVoice, toggleVoice, usePreviewState, useVoiceProgress } from "@/lib/music";
import { formatDuration, useStopVoiceOnLeave } from "@/lib/voice";
import { colors, radius, space } from "@/theme";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { Waveform } from "./Waveform";

// Plays one voice note through the app's single shared player (lib/music.ts):
// starting it stops any song preview or other voice note. Tap the button to
// play/pause; tap or drag along the waveform to seek (while it's playing or
// paused). Stops when the screen loses focus or this unmounts.
export function VoicePlayer({
  playKey,
  uri,
  durationSeconds,
  waveform,
  tone = "paper",
  style,
}: {
  playKey: string; // the storage path (or local uri before upload)
  uri: string | null; // null while the signed URL is loading
  durationSeconds: number;
  waveform: number[];
  tone?: "paper" | "dark";
  style?: StyleProp<ViewStyle>;
}) {
  const shared = usePreviewState();
  const prog = useVoiceProgress();
  useStopVoiceOnLeave(playKey);
  const [width, setWidth] = useState(0);
  const dragging = useRef(false);
  const [dragFraction, setDragFraction] = useState<number | null>(null);

  const current = shared.voiceKey === playKey;
  const playing = current && shared.playing;
  const duration = (current && prog.key === playKey && prog.duration > 0 ? prog.duration : 0) || durationSeconds || 1;
  const position = current && prog.key === playKey ? prog.position : 0;
  const fraction = dragFraction ?? Math.min(1, position / duration);

  const dark = tone === "dark";
  const fg = dark ? colors.warmWhite : colors.ocean;

  function fractionAt(e: GestureResponderEvent) {
    return width > 0 ? Math.max(0, Math.min(1, e.nativeEvent.locationX / width)) : 0;
  }
  function onSeekMove(e: GestureResponderEvent) {
    if (!current) return;
    dragging.current = true;
    setDragFraction(fractionAt(e));
  }
  function onSeekEnd(e: GestureResponderEvent) {
    const f = fractionAt(e);
    setDragFraction(null);
    dragging.current = false;
    if (current) seekVoice(playKey, f * duration);
    else if (uri) toggleVoice(playKey, uri, durationSeconds);
  }

  return (
    <View style={[styles.row, style]}>
      <Pressable
        onPress={() => uri && toggleVoice(playKey, uri, durationSeconds)}
        disabled={!uri}
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause voice note" : "Play voice note"}
        hitSlop={8}
        style={[styles.button, { backgroundColor: fg }]}
      >
        {!uri ? (
          <ActivityIndicator size="small" color={dark ? colors.inkOcean : colors.onDark} />
        ) : (
          <Svg width={16} height={16} viewBox="0 0 16 16">
            {playing ? (
              <>
                <Rect x={3} y={2} width={3.5} height={12} rx={1} fill={dark ? colors.inkOcean : colors.onDark} />
                <Rect x={9.5} y={2} width={3.5} height={12} rx={1} fill={dark ? colors.inkOcean : colors.onDark} />
              </>
            ) : (
              <Path d="M4 2.2 L14 8 L4 13.8 Z" fill={dark ? colors.inkOcean : colors.onDark} />
            )}
          </Svg>
        )}
      </Pressable>
      <View
        style={styles.wave}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => !!uri}
        onMoveShouldSetResponder={() => current}
        onResponderTerminationRequest={() => !dragging.current}
        onResponderMove={onSeekMove}
        onResponderRelease={onSeekEnd}
        onResponderTerminate={() => {
          setDragFraction(null);
          dragging.current = false;
        }}
      >
        <Waveform
          values={waveform}
          progress={current || dragFraction != null ? fraction : 0}
          color={dark ? "rgba(255,248,239,0.35)" : colors.paperEdge}
          playedColor={fg}
        />
      </View>
      <Body variant="small" color={dark ? colors.onDarkSoft : colors.inkSoft} style={styles.time}>
        {current ? `${formatDuration(fraction * duration)} / ${formatDuration(duration)}` : formatDuration(durationSeconds)}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  button: { width: 38, height: 38, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  wave: { flex: 1, height: 36, justifyContent: "center" },
  time: { minWidth: 36, textAlign: "right", fontVariant: ["tabular-nums"] },
});
