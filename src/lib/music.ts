import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, setAudioModeAsync, type AudioStatus } from "expo-audio";
import { Linking } from "react-native";
import { useSyncExternalStore } from "react";

// ---- Song model ----------------------------------------------------------
// Stored as jsonb on memories.song, activity_responses.song, daily_songs.song.
// No Spotify API (dev-mode needs Premium, caps apps at 5 users); search comes
// from the iTunes Search API and cross-platform links from Odesli (song.link).

export type MusicPlatform = "spotify" | "appleMusic" | "youtubeMusic" | "audiomack";

export type Song = {
  itunesId: number;
  title: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null; // upgraded to 600×600
  previewUrl: string | null; // 30s preview (m4a)
  durationMs: number | null;
  links: Partial<Record<MusicPlatform, string>>;
};

export const PLATFORM_LABELS: Record<MusicPlatform, string> = {
  spotify: "Spotify",
  appleMusic: "Apple Music",
  youtubeMusic: "YouTube Music",
  audiomack: "Audiomack",
};

export async function searchSongs(query: string, signal?: AbortSignal): Promise<Song[]> {
  const term = query.trim();
  if (!term) return [];
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=15`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const json = await res.json();
  return (json.results ?? [])
    .filter((r: any) => r.trackId && r.trackName)
    .map(
      (r: any): Song => ({
        itunesId: r.trackId,
        title: r.trackName,
        artist: r.artistName ?? "",
        album: r.collectionName ?? null,
        artworkUrl: r.artworkUrl100 ? String(r.artworkUrl100).replace(/\d+x\d+bb/, "600x600bb") : null,
        previewUrl: r.previewUrl ?? null,
        durationMs: r.trackTimeMillis ?? null,
        links: r.trackViewUrl ? { appleMusic: r.trackViewUrl } : {},
      }),
    );
}

function spotifySearchUrl(song: Song) {
  return `https://open.spotify.com/search/${encodeURIComponent(`${song.title} ${song.artist}`)}`;
}

// Called ONCE when a song is chosen: asks Odesli for the song on every platform.
// Never blocks choosing — on any failure the song keeps what it has, plus a
// Spotify search link as the fallback.
export async function resolveLinks(song: Song): Promise<Song> {
  const links: Song["links"] = { ...song.links };
  try {
    const source = song.links.appleMusic ?? `https://music.apple.com/song/${song.itunesId}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(source)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const p = (await res.json()).linksByPlatform ?? {};
      if (p.spotify?.url) links.spotify = p.spotify.url;
      if (p.appleMusic?.url) links.appleMusic = p.appleMusic.url;
      if (p.youtubeMusic?.url) links.youtubeMusic = p.youtubeMusic.url;
      if (p.audiomack?.url) links.audiomack = p.audiomack.url;
    }
  } catch (e: any) {
    console.log("[music] Odesli lookup failed:", e?.message);
  }
  if (!links.spotify) links.spotify = spotifySearchUrl(song);
  return { ...song, links };
}

// ---- "Open songs in" preference (per user, per device) ----------------------

const PREF_KEY = "music.openIn";

export async function getOpenInPreference(): Promise<MusicPlatform> {
  try {
    const v = await AsyncStorage.getItem(PREF_KEY);
    if (v && v in PLATFORM_LABELS) return v as MusicPlatform;
  } catch {}
  return "spotify";
}

export async function setOpenInPreference(p: MusicPlatform) {
  try {
    await AsyncStorage.setItem(PREF_KEY, p);
  } catch {}
}

// "Open full song": the preferred platform, else any link we have, else a Spotify search.
export async function openFullSong(song: Song) {
  const pref = await getOpenInPreference();
  const order: MusicPlatform[] = [pref, "spotify", "appleMusic", "youtubeMusic", "audiomack"];
  const url = order.map((p) => song.links?.[p]).find(Boolean) ?? spotifySearchUrl(song);
  await Linking.openURL(url);
}

// ---- One shared preview player ---------------------------------------------
// Only one 30s preview plays at a time anywhere in the app. Screens call
// stopPreview() when they lose focus (usePreviewStopOnBlur) and the app stops
// it when backgrounding (see root layout).

let player: ReturnType<typeof createAudioPlayer> | null = null;
let state: { songId: number | null; playing: boolean } = { songId: null, playing: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function setState(next: typeof state) {
  state = next;
  emit();
}

let audioModeSet = false;
async function ensureAudioMode() {
  if (audioModeSet) return;
  audioModeSet = true;
  // A preview is always an explicit tap, so play it even on silent; mix with
  // video sound (the reel plays both).
  await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers" }).catch(() => {});
}

export async function togglePreview(song: Song) {
  if (!song.previewUrl) return;
  // Don't await before play(): iOS Safari only allows audio to start in the
  // same turn as the user's tap, and an await can lose that.
  void ensureAudioMode();
  if (!player) {
    player = createAudioPlayer(null);
    // expo-audio's types reference expo-modules-core, which npm nested under
    // `expo`, so TS can't see SharedObject.addListener — it exists at runtime.
    (player as unknown as {
      addListener: (event: "playbackStatusUpdate", cb: (s: AudioStatus) => void) => void;
    }).addListener("playbackStatusUpdate", (s) => {
      if (s.didJustFinish) setState({ ...state, playing: false });
    });
  }
  if (state.songId === song.itunesId) {
    if (state.playing) {
      player.pause();
      setState({ ...state, playing: false });
    } else {
      if (player.currentTime >= (player.duration || 30) - 0.3) void player.seekTo(0);
      player.play();
      setState({ ...state, playing: true });
    }
    return;
  }
  player.replace({ uri: song.previewUrl });
  player.play();
  setState({ songId: song.itunesId, playing: true });
}

export function stopPreview() {
  if (player && state.playing) player.pause();
  if (state.songId !== null || state.playing) setState({ songId: null, playing: false });
}

export function usePreviewState() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}
