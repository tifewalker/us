import { setRecordingAudioMode } from "@/lib/music";
import { meteringToLevel, toWaveform, type LocalVoice } from "@/lib/voice";
import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  type RecordingOptions,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MicPermission, StartResult, VoiceRecording } from "./types";

// Native recorder (expo-audio): AAC in .m4a, mono, metering on for the live
// level bars and the saved waveform. The web version is useVoiceRecording.web.ts.
const OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 96000,
  isMeteringEnabled: true,
};

const TICK_MS = 80;
const LIVE_BARS = 32;

export function useVoiceRecording(maxSeconds: number, onFinished: (v: LocalVoice) => void): VoiceRecording {
  const recorder = useAudioRecorder(OPTIONS);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveLevels, setLiveLevels] = useState<number[]>([]);
  const levels = useRef<number[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const active = useRef(false);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  const checkPermission = useCallback(async (): Promise<MicPermission> => {
    const p = await getRecordingPermissionsAsync().catch(() => null);
    if (!p) return "undetermined";
    if (p.granted) return "granted";
    return p.canAskAgain ? "undetermined" : "denied";
  }, []);

  const finish = useCallback(
    async (discard: boolean) => {
      if (!active.current) return;
      active.current = false;
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      const durationMs = Math.min(Date.now() - startedAt.current, maxSeconds * 1000);
      setRecording(false);
      try {
        await recorder.stop();
      } catch {}
      await setRecordingAudioMode(false);
      const uri = recorder.uri;
      if (!discard && uri && durationMs > 400) {
        finishedRef.current({ uri, durationMs, waveform: toWaveform(levels.current) });
      }
    },
    [recorder, maxSeconds],
  );

  const start = useCallback(async (): Promise<StartResult> => {
    const p = await requestRecordingPermissionsAsync().catch(() => null);
    if (!p?.granted) return "denied";
    try {
      await setRecordingAudioMode(true);
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e: any) {
      console.log("[voice] start failed:", e?.message);
      await setRecordingAudioMode(false);
      return "error";
    }
    active.current = true;
    levels.current = [];
    startedAt.current = Date.now();
    setElapsedMs(0);
    setLiveLevels([]);
    setRecording(true);
    timer.current = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      let level = 0;
      try {
        level = meteringToLevel(recorder.getStatus().metering);
      } catch {}
      levels.current.push(level);
      setLiveLevels((prev) => [...prev.slice(-(LIVE_BARS - 1)), level]);
      setElapsedMs(elapsed);
      if (elapsed >= maxSeconds * 1000) void finish(false);
    }, TICK_MS);
    return "ok";
  }, [recorder, maxSeconds, finish]);

  // Leaving mid-recording throws it away.
  useEffect(
    () => () => {
      void finish(true);
    },
    [finish],
  );

  return {
    supported: true,
    recording,
    elapsedMs,
    liveLevels,
    checkPermission,
    start,
    stop: () => finish(false),
    cancel: () => finish(true),
  };
}
