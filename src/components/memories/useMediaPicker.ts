import { generateVideoThumbnail, uploadMemoryMedia } from "@/lib/memories";
import { localFileSize, MAX_UPLOAD_BYTES } from "@/lib/upload";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert } from "react-native";

export type PickedAsset = ImagePicker.ImagePickerAsset & {
  thumbnailUri?: string; // local JPEG preview for videos
};

export type UploadProgress = { index: number; total: number; fraction: number };

// Shared by "New memory" and "Add photos or videos": picking (720p video
// re-encode on iOS, size limit, local thumbnails) and sequential upload with
// per-file progress. A failed file never stops the rest.
export function useMediaPicker(logTag = "MediaPicker") {
  const [assets, setAssets] = useState<PickedAsset[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  async function pick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "We need access to your photos to add memories.",
      );
      return;
    }

    // While the picker is open and afterwards (iOS re-encodes videos after
    // the picker closes, which can take a while), show "Preparing…".
    setPreparing(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        quality: 0.8,
        // iOS: re-encode picked videos to 720p H.264 (.mp4) so they fit the
        // upload limit. Marked deprecated in the types, but it's still the
        // option expo-image-picker 57 uses to transcode library videos.
        videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
      });
      if (result.canceled) return;
      console.log(
        `[${logTag}] picked:`,
        result.assets.map((a) => `${a.type} ${a.uri.split("/").pop()} ${a.fileSize ?? "?"}B`),
      );

      const accepted: PickedAsset[] = [];
      let tooBig = 0;
      for (const asset of result.assets) {
        if (asset.type !== "video") {
          accepted.push(asset);
          continue;
        }
        let size = asset.fileSize ?? null;
        if (size == null) {
          try {
            size = await localFileSize(asset.uri);
          } catch (err: any) {
            console.log(`[${logTag}] size check failed:`, err.message);
          }
        }
        if (size != null && size > MAX_UPLOAD_BYTES) {
          tooBig++;
          continue;
        }
        let thumbnailUri: string | undefined;
        try {
          thumbnailUri = await generateVideoThumbnail(asset.uri, asset.duration);
        } catch (err: any) {
          console.log(`[${logTag}] thumbnail failed:`, err.message);
        }
        accepted.push({ ...asset, thumbnailUri });
      }

      if (tooBig > 0) {
        Alert.alert(
          tooBig === 1 ? "Video too long" : `${tooBig} videos too long`,
          "This video is too long to save — try trimming it to under about a minute.",
        );
      }
      setAssets((prev) => [...prev, ...accepted]);
    } catch (err: any) {
      console.log(`[${logTag}] pick failed:`, err);
      Alert.alert("Couldn't add those", err?.message ?? String(err));
    } finally {
      setPreparing(false);
    }
  }

  function remove(uri: string) {
    setAssets((prev) => prev.filter((a) => a.uri !== uri));
  }

  // Runs `upload` for every picked asset, one after another, with per-file
  // progress. Returns human-readable labels for the files that failed.
  async function uploadEach(
    upload: (asset: PickedAsset, mediaType: "photo" | "video", onProgress: (f: number) => void) => Promise<void>,
  ): Promise<string[]> {
    const total = assets.length;
    const failed: string[] = [];
    try {
      for (const [i, asset] of assets.entries()) {
        const mediaType = asset.type === "video" ? "video" : "photo";
        const label = `${mediaType === "video" ? "Video" : "Photo"} ${i + 1}`;
        setProgress({ index: i + 1, total, fraction: 0 });
        try {
          await upload(asset, mediaType, (f) => setProgress({ index: i + 1, total, fraction: f }));
        } catch (err: any) {
          console.log(`[${logTag}] ${label} failed:`, err.message);
          failed.push(`${label}: ${err.message ?? String(err)}`);
        }
      }
    } finally {
      setProgress(null);
    }
    return failed;
  }

  // Uploads every picked asset into a memory (memory_media rows).
  function uploadAll(coupleId: string, memoryId: string): Promise<string[]> {
    return uploadEach((asset, mediaType, onProgress) =>
      uploadMemoryMedia({
        coupleId,
        memoryId,
        localUri: asset.uri,
        mediaType,
        durationMs: asset.duration,
        thumbnailUri: asset.thumbnailUri, mimeType: asset.mimeType,
        onProgress,
      }).then(() => undefined),
    );
  }

  function clear() {
    setAssets([]);
  }

  return { assets, preparing, progress, pick, remove, uploadAll, uploadEach, clear };
}
