import { stopPreview } from "@/lib/music";
import { toWaveform, webRecordingMimeType, type LocalVoice } from "@/lib/voice";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MicPermission, StartResult, VoiceRecording } from "./types";

// Web recorder: MediaRecorder directly (expo-audio's web recorder defaults to
// webm, which iPhones can't play). Only mp4/AAC is accepted; see
// webRecordingMimeType(). Levels come from a Web Audio AnalyserNode.
const TICK_MS = 80;
const LIVE_BARS = 32;

export function useVoiceRecording(maxSeconds: number, onFinished: (v: LocalVoice) => void): VoiceRecording {
  const [mime] = useState(() => webRecordingMimeType());
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveLevels, setLiveLevels] = useState<number[]>([]);
  const levels = useRef<number[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const chunks = useRef<Blob[]>([]);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  const teardown = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
  }, []);

  const checkPermission = useCallback(async (): Promise<MicPermission> => {
    try {
      const p = await (navigator as any).permissions?.query({ name: "microphone" });
      if (p?.state === "granted") return "granted";
      if (p?.state === "denied") return "denied";
    } catch {}
    return "undetermined";
  }, []);

  const finish = useCallback(
    async (discard: boolean) => {
      const r = rec.current;
      if (!r) return;
      rec.current = null;
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      const durationMs = Math.min(Date.now() - startedAt.current, maxSeconds * 1000);
      setRecording(false);
      if (r.state !== "inactive") {
        await new Promise<void>((resolve) => {
          r.onstop = () => resolve();
          try {
            r.stop();
          } catch {
            resolve();
          }
        });
      }
      teardown();
      if (discard || durationMs < 400) return;
      const type = (r.mimeType || mime || "audio/mp4").split(";")[0];
      if (type.includes("webm")) return; // never store webm
      const blob = new Blob(chunks.current, { type });
      finishedRef.current({ uri: URL.createObjectURL(blob), durationMs, waveform: toWaveform(levels.current) });
    },
    [maxSeconds, mime, teardown],
  );

  const start = useCallback(async (): Promise<StartResult> => {
    if (!mime) return "unsupported";
    stopPreview();
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e: any) {
      return e?.name === "NotAllowedError" || e?.name === "SecurityError" ? "denied" : "error";
    }
    stream.current = s;
    let r: MediaRecorder;
    try {
      r = new MediaRecorder(s, { mimeType: mime, audioBitsPerSecond: 96000 });
    } catch {
      teardown();
      return "unsupported";
    }
    chunks.current = [];
    r.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.current.push(e.data);
    };
    // live level meter
    let analyser: AnalyserNode | null = null;
    let buf: Uint8Array<ArrayBuffer> | null = null;
    try {
      const Ctx = (window as any).AudioContext ?? (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      audioCtx.current = ctx;
      if (ctx.state === "suspended") void ctx.resume();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(s).connect(analyser);
      buf = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    } catch {}
    rec.current = r;
    r.start(250);
    levels.current = [];
    startedAt.current = Date.now();
    setElapsedMs(0);
    setLiveLevels([]);
    setRecording(true);
    timer.current = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      let level = 0;
      if (analyser && buf) {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        level = Math.min(1, Math.sqrt(sum / buf.length) * 4);
      }
      levels.current.push(level);
      setLiveLevels((prev) => [...prev.slice(-(LIVE_BARS - 1)), level]);
      setElapsedMs(elapsed);
      if (elapsed >= maxSeconds * 1000) void finish(false);
    }, TICK_MS);
    return "ok";
  }, [mime, maxSeconds, finish, teardown]);

  // Leaving mid-recording throws it away.
  useEffect(
    () => () => {
      void finish(true);
    },
    [finish],
  );

  return {
    supported: !!mime,
    recording,
    elapsedMs,
    liveLevels,
    checkPermission,
    start,
    stop: () => finish(false),
    cancel: () => finish(true),
  };
}
