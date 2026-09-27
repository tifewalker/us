import { useSyncExternalStore } from "react";

// In-app notification banners (shown while the app is open): from a Web Push
// the service worker forwards to an open window, or from a Realtime event the
// app already listens to (answers, reveals) — whichever arrives first. The
// same `key` (the push tag, "<kind>:<ref>") never shows twice within 10 min,
// so a push and its Realtime twin appear once. One banner at a time.

export type Banner = {
  key: string; // "<kind>:<ref>" — same as the push tag
  kind: string;
  title: string;
  body?: string;
  url: string;
};

const DEDUPE_MS = 10 * 60_000;
const seen = new Map<string, number>();
let queue: Banner[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showBanner(b: Banner) {
  const now = Date.now();
  for (const [k, at] of seen) if (now - at > DEDUPE_MS) seen.delete(k);
  if (seen.has(b.key)) return;
  seen.set(b.key, now);
  queue = [...queue, b];
  emit();
}

// The host calls this when the current banner is dismissed / opened.
export function nextBanner() {
  queue = queue.slice(1);
  emit();
}

export function useCurrentBanner(): Banner | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => queue[0] ?? null,
  );
}

// 3D icon per kind (see DESIGN.md → Icons).
export function bannerIcon(kind: string) {
  if (kind.startsWith("nudge_song") || kind === "song_picked") return "headphone" as const;
  if (kind.startsWith("question") || kind === "spicy") return "sparkles" as const;
  if (kind.startsWith("missions")) return "envelope" as const;
  if (kind.startsWith("memory") || kind.startsWith("reflection") || kind === "remember") return "camera" as const;
  if (kind.startsWith("bottle") || kind === "open_when_sent") return "bottle" as const;
  if (kind.startsWith("gift")) return "gift" as const;
  if (kind.startsWith("birthday")) return "cake" as const;
  if (kind.startsWith("anniv") || kind === "recap_ready") return "sun" as const;
  if (kind === "date_today") return "calendar" as const;
  return "loveLetter" as const;
}
