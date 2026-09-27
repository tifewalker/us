import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

// Signed URLs, cached. The bucket is private, so every image needs a signed
// URL — and a NEW signed URL is a new address, which the browser can't cache.
// Re-signing on every screen meant the web app re-downloaded every photo every
// time. Now each path gets one 7-day URL, reused (in memory + AsyncStorage /
// localStorage) until it has less than a day left, so Safari's HTTP cache and
// expo-image's disk cache both hit. Files never change in place (every upload
// has a new name, served with a 1-year Cache-Control), so a cached URL always
// shows the right bytes. A URL only exists if signing succeeded, so this never
// bypasses a storage rule; locked files simply never get one.

const BUCKET = "memory-media";
const SIGN_SECONDS = 7 * 24 * 3600;
const MIN_LEFT_MS = 24 * 3600 * 1000; // re-sign when less than a day is left
const STORE_KEY = "signedUrls.v1";
const MAX_ENTRIES = 4000;

type Entry = { url: string; exp: number };
let cache: Map<string, Entry> | null = null;
let loading: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function load() {
  if (cache) return;
  if (!loading) {
    loading = (async () => {
      const m = new Map<string, Entry>();
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        if (raw) {
          const now = Date.now();
          for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, Entry>)) {
            if (v && typeof v.url === "string" && v.exp - now > MIN_LEFT_MS) m.set(k, v);
          }
        }
      } catch {}
      cache = m;
    })();
  }
  await loading;
}

function persistSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (!cache) return;
    // keep the newest entries only
    const entries = [...cache.entries()].sort((a, b) => b[1].exp - a[1].exp).slice(0, MAX_ENTRIES);
    try {
      await AsyncStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {}
  }, 800);
}

// path → URL for every path that could be signed (missing / locked ones are
// simply absent). `fresh` skips the cache (used to check a file still exists).
export async function signPathsCached(paths: string[], opts: { fresh?: boolean; seconds?: number } = {}): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  const out: Record<string, string> = {};
  const now = Date.now();
  if (!opts.fresh) {
    await load();
    for (const p of unique) {
      const e = cache!.get(p);
      if (e && e.exp - now > MIN_LEFT_MS) out[p] = e.url;
    }
  }
  const missing = unique.filter((p) => !out[p]);
  const seconds = opts.seconds ?? SIGN_SECONDS;
  for (let i = 0; i < missing.length; i += 500) {
    const chunk = missing.slice(i, i + 500);
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(chunk, seconds);
    if (error) throw error;
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) {
        out[item.path] = item.signedUrl;
        if (!opts.fresh && cache) cache.set(item.path, { url: item.signedUrl, exp: now + seconds * 1000 });
      }
    }
  }
  if (!opts.fresh && missing.length) persistSoon();
  return out;
}

// After deleting files: drop their cached URLs.
export function forgetSigned(paths: string[]) {
  if (!cache) return;
  let changed = false;
  for (const p of paths) changed = cache.delete(p) || changed;
  if (changed) persistSoon();
}

// Sign-out / delete world: forget everything.
export async function clearSignedCache() {
  cache = new Map();
  try {
    await AsyncStorage.removeItem(STORE_KEY);
  } catch {}
}
