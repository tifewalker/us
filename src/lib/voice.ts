import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { getSharedAudioState, stopPreview } from "./music";
import { uploadLocalFile } from "./upload";

// ---- Voice notes (migration 018) -----------------------------------------------
// Always AAC in an MP4 container, stored as .m4a with content type audio/mp4
// (both native recorders and iOS Safari's MediaRecorder produce it). WebM is
// never saved: iPhones can't play it back.

// What's stored in the database (activity_responses.voice,
// memory_reflections.voice, question_answers.voice, bottles.media items).
export type VoiceNote = {
  storage_path: string;
  duration_seconds: number;
  waveform: number[]; // WAVEFORM_BARS values, 0..1
};

// A recording that hasn't been uploaded yet.
export type LocalVoice = {
  uri: string; // file:// on native, blob: on web
  durationMs: number;
  waveform: number[];
};

export const WAVEFORM_BARS = 48;
export const MAX_VOICE_SECONDS = 120; // memories, bottles, gifts
export const MAX_ANSWER_VOICE_SECONDS = 60; // activities, questions, perspectives

// Native metering is dBFS (about -160..0). Speech sits roughly in -50..-5.
export function meteringToLevel(db: number | undefined | null): number {
  if (db == null || !isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db + 55) / 50));
}

// Squashes the level samples collected while recording into WAVEFORM_BARS
// values, normalised so the loudest bar is 1 (with a small floor so silence
// still draws a visible bar).
export function toWaveform(levels: number[], bars = WAVEFORM_BARS): number[] {
  if (levels.length === 0) return Array(bars).fill(0.15);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const a = Math.floor((i * levels.length) / bars);
    const b = Math.max(a + 1, Math.floor(((i + 1) * levels.length) / bars));
    let peak = 0;
    for (let j = a; j < b && j < levels.length; j++) peak = Math.max(peak, levels[j]);
    out.push(peak);
  }
  const max = Math.max(...out, 0.001);
  return out.map((v) => Math.round(Math.max(0.12, v / max) * 100) / 100);
}

// Tolerates anything from the database (old rows, hand-edited jsonb).
export function asWaveform(v: unknown): number[] {
  if (!Array.isArray(v) || v.length === 0) return Array(WAVEFORM_BARS).fill(0.3);
  return v.map((x) => (typeof x === "number" && isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.3));
}

export function asVoiceNote(v: unknown): VoiceNote | null {
  if (!v || typeof v !== "object" || typeof (v as any).storage_path !== "string") return null;
  const o = v as any;
  return {
    storage_path: o.storage_path,
    duration_seconds: Number(o.duration_seconds) || 0,
    waveform: asWaveform(o.waveform),
  };
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---- Web support -------------------------------------------------------------
// iOS Safari's MediaRecorder records audio/mp4. Chrome records mp4 in recent
// versions; Firefox only does webm → unsupported (we never store webm).
export function webRecordingMimeType(): string | null {
  if (Platform.OS !== "web") return null;
  const MR = (globalThis as any).MediaRecorder;
  if (!MR || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  for (const t of ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac"]) {
    try {
      if (MR.isTypeSupported?.(t)) return t;
    } catch {}
  }
  return null;
}

export const UNSUPPORTED_MESSAGE = "Voice notes aren't supported in this browser — try Safari or the app.";

export const DENIED_MESSAGE =
  Platform.OS === "web"
    ? "The microphone is blocked for this page. In Safari: tap “aA” in the address bar → Website Settings → Microphone → Allow, then try again."
    : Platform.OS === "ios"
      ? "Microphone access is off. Open Settings → Expo Go (or Us) → turn on Microphone, then try again."
      : "Microphone access is off. Open Settings → Apps → Expo Go (or Us) → Permissions → Microphone, then try again.";

// ---- Upload --------------------------------------------------------------------

// `folder` decides who can read it (see migration 018):
//   <couple>/<memory>                                    memory voice notes
//   <couple>/sealed/<bottle>                             bottles & gifts (sealed rules)
//   <couple>/activity-responses/<daily>/<me>             activity answers (reveal rules)
//   <couple>/reflections/<memory>/<me>                   Two perspectives (reveal rules)
//   <couple>/questions/<thread>/<me>                     question answers (reveal rules)
export async function uploadVoice(folder: string, voice: LocalVoice, onProgress?: (f: number) => void): Promise<VoiceNote> {
  const name = `voice-${Date.now()}-${Math.floor(Math.random() * 10000)}.m4a`;
  const storage_path = await uploadLocalFile({ localUri: voice.uri, path: `${folder}/${name}`, onProgress });
  return {
    storage_path,
    duration_seconds: Math.max(1, Math.round(voice.durationMs / 1000)),
    waveform: voice.waveform,
  };
}

// ---- Playback helpers ----------------------------------------------------------

// Stops this voice note if it's the one playing when the screen loses focus
// or the component unmounts (never stops some other note that took over).
export function useStopVoiceOnLeave(key: string | null) {
  const keyRef = useRef(key);
  keyRef.current = key;
  const stopIfMine = useCallback(() => {
    const k = keyRef.current;
    if (k && getSharedAudioState().voiceKey === k) stopPreview();
  }, []);
  useFocusEffect(useCallback(() => stopIfMine, [stopIfMine]));
  useEffect(() => stopIfMine, [stopIfMine]);
}
