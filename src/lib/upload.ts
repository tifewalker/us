import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Per-file cap. Supabase Free plan's global limit is 50 MB, and migration 011
// sets the same limit on the memory-media bucket — keep these in sync.
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const BUCKET = "memory-media";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  mov: "video/quicktime",
  mp4: "video/mp4",
};

// Lowercased extension from a uri/path, ignoring any query string.
export function extensionOf(uri: string): string {
  return uri.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
}

export function contentTypeFor(pathOrUri: string): string {
  const type = CONTENT_TYPES[extensionOf(pathOrUri)];
  if (!type) throw new Error(`Unsupported file type: .${extensionOf(pathOrUri)}`);
  return type;
}

// The storage extension for a picked video. Native uris end in .mov/.mp4; on
// web the uri is a blob: URL, so fall back to the picker's mimeType.
export function videoExtension(localUri: string, mimeType?: string | null): string {
  const ext = extensionOf(localUri);
  if (ext === "mov" || ext === "mp4") return ext;
  if (mimeType === "video/quicktime") return "mov";
  return "mp4";
}

// Size in bytes of a local file, or null if it can't be read.
export async function localFileSize(uri: string): Promise<number | null> {
  if (Platform.OS === "web") {
    try {
      return (await (await fetch(uri)).blob()).size;
    } catch {
      return null;
    }
  }
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? info.size : null;
}

// Uploads a local file to memory-media at `path`: gets a signed upload URL,
// then PUTs the bytes. The content type always comes from `path`'s extension
// (the storage path is authoritative; web uris are blob:/data: URLs).
//  - Native: expo-file-system streams the file (never read into JS memory).
//  - Web: fetch the blob, XHR PUT with upload progress (no streaming API there).
// `onProgress` receives 0..1.
export async function uploadLocalFile(params: {
  localUri: string;
  path: string;
  onProgress?: (fraction: number) => void;
}): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(params.path);
  if (error) throw error;

  const headers: Record<string, string> = {
    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    "content-type": contentTypeFor(params.path),
    "cache-control": "max-age=3600",
    "x-upsert": "false",
  };

  if (Platform.OS === "web") {
    const blob = await (await fetch(params.localUri)).blob();
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", data.signedUrl);
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) params.onProgress?.(e.loaded / e.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        let message = xhr.responseText;
        try {
          message = JSON.parse(xhr.responseText).message ?? message;
        } catch {}
        reject(new Error(`Upload failed (${xhr.status}): ${message}`));
      };
      xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
      xhr.send(blob);
    });
    params.onProgress?.(1);
    return params.path;
  }

  const task = FileSystem.createUploadTask(
    data.signedUrl,
    params.localUri,
    {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers,
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      if (totalBytesExpectedToSend > 0) {
        params.onProgress?.(totalBytesSent / totalBytesExpectedToSend);
      }
    },
  );

  const result = await task.uploadAsync();
  if (!result) throw new Error("Upload was cancelled");
  if (result.status < 200 || result.status >= 300) {
    let message = result.body;
    try {
      message = JSON.parse(result.body).message ?? message;
    } catch {}
    throw new Error(`Upload failed (${result.status}): ${message}`);
  }
  params.onProgress?.(1);
  return params.path;
}
