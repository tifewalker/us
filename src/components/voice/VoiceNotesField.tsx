import { Button, PressableScale, seededTilt } from "@/components/ui";
import type { LocalVoice } from "@/lib/voice";
import { colors, radius, shadows, space, type as typeScale } from "@/theme";
import { useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { VoicePlayer } from "./VoicePlayer";
import { VoiceRecorder } from "./VoiceRecorder";

// Form field for not-yet-uploaded voice notes: each one is a little paper tag
// with its player and a "Remove"; "Add a voice note" opens the recorder
// inline. `max` counts voice notes already saved (`existingCount`) too.
export function VoiceNotesField({
  voices,
  onAdd,
  onRemove,
  max = 1,
  existingCount = 0,
  maxSeconds,
  addLabel = "Add a voice note",
  recorderLabel,
  disabled,
  style,
}: {
  voices: LocalVoice[];
  onAdd: (v: LocalVoice) => void;
  onRemove: (uri: string) => void;
  max?: number;
  existingCount?: number;
  maxSeconds: number;
  addLabel?: string;
  recorderLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [recording, setRecording] = useState(false);
  const full = existingCount + voices.length >= max;

  return (
    <View style={[styles.wrap, style]}>
      {voices.map((v) => (
        <View key={v.uri} style={[styles.tag, { transform: [{ rotate: `${seededTilt(v.uri, 1.2)}deg` }] }]}>
          <VoicePlayer playKey={v.uri} uri={v.uri} durationSeconds={v.durationMs / 1000} waveform={v.waveform} style={styles.flex} />
          <PressableScale onPress={() => onRemove(v.uri)} disabled={disabled} accessibilityRole="button" accessibilityLabel="Remove voice note" hitSlop={8}>
            <Text style={[typeScale.small, styles.remove]}>Remove</Text>
          </PressableScale>
        </View>
      ))}
      {recording ? (
        <VoiceRecorder
          maxSeconds={maxSeconds}
          label={recorderLabel}
          onUse={(v) => {
            onAdd(v);
            setRecording(false);
          }}
          onCancel={() => setRecording(false)}
        />
      ) : (
        !full && <Button title={addLabel} variant="soft" icon="radio" onPress={() => setRecording(true)} disabled={disabled} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.warmWhite,
    borderRadius: radius.paper,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    ...shadows.lifted,
  },
  remove: { color: colors.danger },
  flex: { flex: 1 },
});
