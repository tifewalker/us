import { signPaths } from "@/lib/memories";
import { asVoiceNote } from "@/lib/voice";
import { useEffect, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { VoicePlayer } from "./VoicePlayer";

// Signed URL for one private voice file (null until signed, or if the
// database won't let us read it yet — e.g. before the reveal).
export function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (!path) return;
    signPaths([path], 3600)
      .then((m) => alive && setUrl(m[path] ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

// A stored voice answer (the jsonb `voice` column) as a player.
export function AnswerVoice({ voice, tone, style }: { voice: unknown; tone?: "paper" | "dark"; style?: StyleProp<ViewStyle> }) {
  const note = asVoiceNote(voice);
  const url = useSignedUrl(note?.storage_path);
  if (!note) return null;
  return <VoicePlayer playKey={note.storage_path} uri={url} durationSeconds={note.duration_seconds} waveform={note.waveform} tone={tone} style={style} />;
}
