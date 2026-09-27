import { stopPreview } from "@/lib/music";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

// Stops any playing song preview when this screen loses focus.
export function usePreviewStopOnBlur() {
  useFocusEffect(
    useCallback(() => {
      return () => stopPreview();
    }, []),
  );
}
