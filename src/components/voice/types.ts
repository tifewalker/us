export type MicPermission = "granted" | "undetermined" | "denied";
export type StartResult = "ok" | "denied" | "unsupported" | "error";

// Shared shape of the native (expo-audio) and web (MediaRecorder) recorders.
export type VoiceRecording = {
  supported: boolean; // false on browsers that can only record webm
  recording: boolean;
  elapsedMs: number;
  liveLevels: number[]; // recent 0..1 levels for the live meter
  checkPermission: () => Promise<MicPermission>;
  start: () => Promise<StartResult>;
  stop: () => Promise<void>; // delivers the recording via onFinished
  cancel: () => Promise<void>;
};
