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

// ---- One shared audio player ------------------------------------------------
// Only one sound plays at a time anywhere in the app: a 30s song preview OR a
// voice note (lib/voice.ts). Screens call stopPreview() when they lose focus
// (usePreviewStopOnBlur) and the app stops it when backgrounding (see root
// layout) — both stop voice notes too.

let player: ReturnType<typeof createAudioPlayer> | null = null;
type SharedState = { songId: number | null; voiceKey: string | null; playing: boolean };
let state: SharedState = { songId: null, voiceKey: null, playing: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function setState(next: SharedState) {
  state = next;
  emit();
}

// Voice-note progress changes several times a second, so it has its own store
// (song-preview consumers don't re-render on every tick).
let progress = { key: null as string | null, position: 0, duration: 0 };
const progressListeners = new Set<() => void>();
function setProgress(next: typeof progress) {
  progress = next;
  progressListeners.forEach((l) => l());
}

let recordingMode = false;
let audioModeSet = false;
async function ensureAudioMode() {
  if (audioModeSet && !recordingMode) return;
  audioModeSet = true;
  recordingMode = false;
  // Playback is always an explicit tap, so play even on silent; mix with
  // video sound (the reel plays both).
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: "mixWithOthers" }).catch(() => {});
}

// iOS needs allowsRecording while the mic is on, and it must be switched back
// off afterwards or playback comes out of the earpiece.
export async function setRecordingAudioMode(on: boolean) {
  stopPreview();
  recordingMode = on;
  await setAudioModeAsync(
    on
      ? { playsInSilentMode: true, allowsRecording: true, interruptionMode: "doNotMix" }
      : { playsInSilentMode: true, allowsRecording: false, interruptionMode: "mixWithOthers" },
  ).catch(() => {});
}

function getPlayer() {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 100 });
    // expo-audio's types reference expo-modules-core, which npm nested under
    // `expo`, so TS can't see SharedObject.addListener — it exists at runtime.
    (player as unknown as {
      addListener: (event: "playbackStatusUpdate", cb: (s: AudioStatus) => void) => void;
    }).addListener("playbackStatusUpdate", (s) => {
      if (state.voiceKey) {
        setProgress({
          key: state.voiceKey,
          position: s.didJustFinish ? 0 : s.currentTime,
          duration: s.duration || progress.duration,
        });
      }
      if (s.didJustFinish) setState({ ...state, playing: false });
    });
  }
  return player;
}

export async function togglePreview(song: Song) {
  if (!song.previewUrl) return;
  // Don't await before play(): iOS Safari only allows audio to start in the
  // same turn as the user's tap, and an await can lose that.
  void ensureAudioMode();
  const p = getPlayer();
  if (state.songId === song.itunesId) {
    if (state.playing) {
      p.pause();
      setState({ ...state, playing: false });
    } else {
      if (p.currentTime >= (p.duration || 30) - 0.3) void p.seekTo(0);
      p.play();
      setState({ ...state, playing: true });
    }
    return;
  }
  p.replace({ uri: song.previewUrl });
  p.play();
  setState({ songId: song.itunesId, voiceKey: null, playing: true });
}

// Voice notes: `key` identifies the note (its storage path, or the local uri
// for a preview before upload); `uri` is a signed URL / local file / blob URL.
export function toggleVoice(key: string, uri: string, knownDuration = 0) {
  void ensureAudioMode();
  const p = getPlayer();
  if (state.voiceKey === key) {
    if (state.playing) {
      p.pause();
      setState({ ...state, playing: false });
    } else {
      if (progress.position <= 0.05) void p.seekTo(0);
      p.play();
      setState({ ...state, playing: true });
    }
    return;
  }
  p.replace({ uri });
  p.play();
  setProgress({ key, position: 0, duration: knownDuration });
  setState({ songId: null, voiceKey: key, playing: true });
}

export function seekVoice(key: string, seconds: number) {
  if (!player || state.voiceKey !== key) return;
  void player.seekTo(Math.max(0, seconds));
  setProgress({ ...progress, position: Math.max(0, seconds) });
}

export function stopPreview() {
  if (player && state.playing) player.pause();
  if (state.songId !== null || state.voiceKey !== null || state.playing) setState({ songId: null, voiceKey: null, playing: false });
  if (progress.key) setProgress({ key: null, position: 0, duration: 0 });
}

export function getSharedAudioState() {
  return state;
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

export function useVoiceProgress() {
  return useSyncExternalStore(
    (cb) => {
      progressListeners.add(cb);
      return () => progressListeners.delete(cb);
    },
    () => progress,
  );
}
