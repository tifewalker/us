import * as ImageManipulator from "expo-image-manipulator";
import * as VideoThumbnails from "expo-video-thumbnails";
import { supabase } from "./supabase";
import type { Song } from "./music";
import { Platform } from "react-native";
import { uploadLocalFile, videoExtension } from "./upload";
import { asVoiceNote, asWaveform, uploadVoice, type LocalVoice } from "./voice";

export type MediaType = "photo" | "video" | "voice";

export async function createMemory(params: {
  coupleId: string;
  title: string;
  description?: string;
  memoryDate?: string; // 'YYYY-MM-DD'
  location?: string;
  song?: Song | null;
}) {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("memories")
    .insert({
      couple_id: params.coupleId,
      title: params.title,
      description: params.description ?? null,
      memory_date: params.memoryDate ?? null,
      location: params.location ?? null,
      song: params.song ?? null,
      created_by: authData.user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Generates a local JPEG thumbnail ~1s into a video (or the first frame for
// shorter clips). Used for the create-screen preview and uploaded alongside the video.
export async function generateVideoThumbnail(
  videoUri: string,
  durationMs?: number | null,
) {
  const time = durationMs != null && durationMs < 1000 ? 0 : 1000;
  if (Platform.OS === "web") return webVideoThumbnail(videoUri, time / 1000);
  const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
    time,
    quality: 0.7,
  });
  return uri;
}

// Web: expo-video-thumbnails has no web implementation, so draw a frame from
// a hidden <video> onto a <canvas> and return a JPEG data: URL. (iOS Safari
// needs muted + playsInline to load the frame without a user gesture.)
function webVideoThumbnail(src: string, atSeconds: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const doc = (globalThis as any).document;
    if (!doc) return reject(new Error("No document"));
    const video = doc.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.preload = "auto";
    video.src = src;
    const timer = setTimeout(() => reject(new Error("Thumbnail timed out")), 10000);
    video.onloadeddata = () => {
      video.currentTime = Math.min(atSeconds, Math.max(0, (video.duration || 1) - 0.1));
    };
    video.onseeked = () => {
      try {
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 360;
        const scale = Math.min(1, 720 / Math.max(w, h));
        const canvas = doc.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        clearTimeout(timer);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      } catch (e) {
        clearTimeout(timer);
        reject(e);
      }
    };
    video.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Couldn't read the video"));
    };
  });
}

export type MediaRef = {
  storage_path: string;
  thumbnail_path: string | null;
  media_type: MediaType;
  duration_seconds: number | null;
  waveform?: number[] | null; // voice notes only (018)
};

// Uploads one local photo/video (+ a thumbnail for videos) into `folder` and
// returns where it went. Photos are converted to JPEG (HEIC fix); files stream
// from disk (upload.ts), never through JS memory. Used for memories
// (<couple_id>/<memory_id>) and sealed gifts (<couple_id>/sealed/<bottle_id>).
export async function uploadMediaFile(params: {
  folder: string;
  localUri: string;
  mediaType: MediaType;
  durationMs?: number | null;
  thumbnailUri?: string;
  mimeType?: string | null; // from the picker; needed on web (blob: uris have no extension)
  onProgress?: (fraction: number) => void;
}): Promise<MediaRef> {
  const baseName = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  let uploadUri = params.localUri;
  let ext = params.mediaType === "video" ? videoExtension(params.localUri, params.mimeType) : "jpg";

  if (params.mediaType === "photo") {
    // Convert every photo to JPEG regardless of source format (iPhones
    // default to HEIC, which Storage would otherwise serve back with a
    // mismatched content-type, causing <Image> to silently fail to render).
    const manipulated = await ImageManipulator.manipulateAsync(
      params.localUri,
      [],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    uploadUri = manipulated.uri;
    ext = "jpg";
  }

  const storagePath = await uploadLocalFile({
    localUri: uploadUri,
    path: `${params.folder}/${baseName}.${ext}`,
    onProgress: params.onProgress,
  });

  let thumbnailPath: string | null = null;
  if (params.mediaType === "video") {
    // A missing thumbnail shouldn't lose the video — the grid falls back to a placeholder.
    try {
      const thumbUri =
        params.thumbnailUri ??
        (await generateVideoThumbnail(params.localUri, params.durationMs));
      thumbnailPath = await uploadLocalFile({
        localUri: thumbUri,
        path: `${params.folder}/thumb_${baseName}.jpg`,
      });
    } catch (err: any) {
      console.log("[uploadMediaFile] thumbnail failed:", err.message);
    }
  }

  return {
    storage_path: storagePath,
    thumbnail_path: thumbnailPath,
    media_type: params.mediaType,
    duration_seconds: params.durationMs != null ? Math.round(params.durationMs / 1000) : null,
  };
}

// Uploads a single local photo/video into a memory and creates the matching
// memory_media row. Path convention: <couple_id>/<memory_id>/<name>.<ext>
// (+ thumb_<name>.jpg for videos) — what the storage RLS policies check.
export async function uploadMemoryMedia(params: {
  coupleId: string;
  memoryId: string;
  localUri: string;
  mediaType: MediaType;
  durationMs?: number | null; // from the picker asset (videos)
  thumbnailUri?: string; // local video thumbnail, if already generated
  mimeType?: string | null;
  caption?: string;
  onProgress?: (fraction: number) => void;
}) {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("Not signed in");

  const ref = await uploadMediaFile({
    folder: `${params.coupleId}/${params.memoryId}`,
    localUri: params.localUri,
    mediaType: params.mediaType,
    durationMs: params.durationMs,
    thumbnailUri: params.thumbnailUri,
    mimeType: params.mimeType,
    onProgress: params.onProgress,
  });
  const storagePath = ref.storage_path;
  const thumbnailPath = ref.thumbnail_path;

  const { data, error } = await supabase
    .from("memory_media")
    .insert({
      memory_id: params.memoryId,
      media_type: params.mediaType,
      storage_path: storagePath,
      thumbnail_path: thumbnailPath,
      duration_seconds:
        params.durationMs != null ? Math.round(params.durationMs / 1000) : null,
      caption: params.caption ?? null,
      created_by: authData.user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// A voice note in a memory: an .m4a in the memory's folder + a memory_media
// row (media_type 'voice', with its waveform). Delete rules are the same as
// photos (removeMediaItem / deleteMemory remove the file first).
export async function addMemoryVoice(params: {
  coupleId: string;
  memoryId: string;
  voice: LocalVoice;
  onProgress?: (fraction: number) => void;
}) {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("Not signed in");
  const note = await uploadVoice(`${params.coupleId}/${params.memoryId}`, params.voice, params.onProgress);
  const { data, error } = await supabase
    .from("memory_media")
    .insert({
      memory_id: params.memoryId,
      media_type: "voice",
      storage_path: note.storage_path,
      thumbnail_path: null,
      duration_seconds: note.duration_seconds,
      waveform: note.waveform,
      created_by: authData.user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Returns a temporary signed URL for displaying a private media file.
export async function getSignedMediaUrl(
  storagePath: string,
  expiresInSeconds = 3600,
) {
  const { data, error } = await supabase.storage
    .from("memory-media")
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}

// Signs many files in ONE request (createSignedUrls). Returns path → URL;
// paths that fail to sign (e.g. missing) are simply absent from the map.
export async function signPaths(
  paths: string[],
  expiresInSeconds = 3600,
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data, error } = await supabase.storage
    .from("memory-media")
    .createSignedUrls(unique, expiresInSeconds);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) out[item.path] = item.signedUrl;
  }
  return out;
}

export type MemoryMediaRow = {
  id: string;
  media_type: string;
  storage_path: string;
  thumbnail_path: string | null;
  duration_seconds: number | null;
  waveform?: unknown;
};

export type ResolvedMedia = {
  id: string;
  type: string;
  url: string; // full photo or video
  thumbUrl: string | null; // photo itself, or the video's thumbnail
  // Stable expo-image cache keys (the storage paths), so images stay cached
  // even though signed URLs change every time they're re-signed.
  cacheKey: string;
  thumbCacheKey: string | null;
  storagePath: string;
  thumbnailPath: string | null;
  durationSeconds: number | null;
  waveform: number[] | null; // voice notes only
};

// Signs every item of a memory in one request (1 hour — long enough to watch
// a video). Items whose main file fails to sign are skipped.
export async function resolveMedia(
  rows: MemoryMediaRow[],
): Promise<ResolvedMedia[]> {
  const urls = await signPaths(
    rows.flatMap((m) => [m.storage_path, m.thumbnail_path ?? ""]),
    3600,
  );
  const out: ResolvedMedia[] = [];
  for (const m of rows) {
    const url = urls[m.storage_path];
    if (!url) {
      console.log("[resolveMedia] couldn't sign", m.storage_path);
      continue;
    }
    const isPhoto = m.media_type === "photo";
    out.push({
      id: m.id,
      type: m.media_type,
      url,
      thumbUrl: isPhoto ? url : m.thumbnail_path ? (urls[m.thumbnail_path] ?? null) : null,
      cacheKey: m.storage_path,
      thumbCacheKey: isPhoto ? m.storage_path : m.thumbnail_path,
      storagePath: m.storage_path,
      thumbnailPath: m.thumbnail_path,
      durationSeconds: m.duration_seconds,
      waveform: m.media_type === "voice" ? asWaveform(m.waveform) : null,
    });
  }
  return out;
}

export function formatSeconds(total: number) {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export async function getMemoriesForCouple(coupleId: string) {
  const { data, error } = await supabase
    .from("memories")
    .select("*, memory_media(*)")
    .eq("couple_id", coupleId)
    .order("memory_date", { ascending: false })
    .order("created_at", { referencedTable: "memory_media", ascending: true });

  if (error) throw error;
  return data;
}

export async function getMemoryById(memoryId: string) {
  const { data, error } = await supabase
    .from("memories")
    .select("*, memory_media(*)")
    .eq("id", memoryId)
    .order("created_at", { referencedTable: "memory_media", ascending: true })
    .single();

  if (error) throw error;
  return data;
}

export async function updateMemory(
  memoryId: string,
  fields: {
    title: string;
    description: string | null;
    location: string | null;
    memoryDate: string | null;
    song: Song | null;
  },
) {
  const { data, error } = await supabase
    .from("memories")
    .update({
      title: fields.title,
      description: fields.description,
      location: fields.location,
      memory_date: fields.memoryDate,
      song: fields.song,
    })
    .eq("id", memoryId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Couldn't save — this memory may have been deleted.");
}

// ---- Deleting: storage files FIRST, rows only if every file is gone ----------

function mediaPaths(rows: { storage_path: string; thumbnail_path: string | null }[]) {
  return rows.flatMap((m) => [m.storage_path, m.thumbnail_path]).filter((p): p is string => !!p);
}

// Removes files and reports which ones are *still there* afterwards.
// Storage's remove() silently skips files it can't (or needn't) delete, so a
// path missing from its result is re-checked: if it can still be signed it
// really still exists (a failure); if not, it was already gone (fine).
async function removeFiles(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data, error } = await supabase.storage.from("memory-media").remove(paths);
  if (error) throw new Error(`Couldn't remove the files: ${error.message}`);
  const removed = new Set((data ?? []).map((o: any) => o.name));
  const unconfirmed = paths.filter((p) => !removed.has(p));
  if (unconfirmed.length === 0) return [];
  const stillThere = await signPaths(unconfirmed, 60).catch(() => ({}) as Record<string, string>);
  return unconfirmed.filter((p) => stillThere[p]);
}

function fileLabel(path: string) {
  return path.split("/").pop() ?? path;
}

// Deletes a whole memory: all media files and thumbnails first, then the
// memory row (the DB cascade removes its memory_media rows). If any file
// can't be removed, the row is kept and the error lists what failed.
export async function deleteMemory(memoryId: string) {
  const memory = await getMemoryById(memoryId);
  // Two-perspectives voice notes I can see (mine, and my partner's once revealed).
  const { data: reflections } = await supabase.from("memory_reflections").select("voice").eq("memory_id", memoryId);
  const voicePaths = (reflections ?? []).map((r: any) => asVoiceNote(r.voice)?.storage_path).filter((p): p is string => !!p);
  const failed = await removeFiles([...mediaPaths(memory.memory_media ?? []), ...voicePaths]);
  if (failed.length > 0) {
    throw new Error(`These files couldn't be removed, so the memory was kept:\n${failed.map(fileLabel).join("\n")}`);
  }
  const { data, error } = await supabase.from("memories").delete().eq("id", memoryId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("The files were removed, but the memory itself couldn't be deleted.");
  // A partner's side that I hadn't unlocked yet was invisible to me until now;
  // once the memory is gone, migration 019 lets either of us clean it up.
  await sweepReflectionVoices(memory.couple_id, memoryId);
}

async function sweepReflectionVoices(coupleId: string, memoryId: string) {
  try {
    const base = `${coupleId}/reflections/${memoryId}`;
    const { data: folders } = await supabase.storage.from("memory-media").list(base);
    const paths: string[] = [];
    for (const f of folders ?? []) {
      const { data: files } = await supabase.storage.from("memory-media").list(`${base}/${f.name}`);
      for (const file of files ?? []) paths.push(`${base}/${f.name}/${file.name}`);
    }
    if (paths.length) await supabase.storage.from("memory-media").remove(paths);
  } catch (err: any) {
    console.log("[deleteMemory] reflection voice sweep failed:", err?.message);
  }
}

// Removes one photo/video (and its thumbnail) from a memory, same rule:
// storage first, then the memory_media row.
export async function removeMediaItem(media: { id: string; storage_path: string; thumbnail_path: string | null }) {
  const failed = await removeFiles(mediaPaths([media]));
  if (failed.length > 0) {
    throw new Error(`These files couldn't be removed, so the item was kept:\n${failed.map(fileLabel).join("\n")}`);
  }
  const { data, error } = await supabase.from("memory_media").delete().eq("id", media.id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("The file was removed, but the item couldn't be taken out of the memory.");
}
