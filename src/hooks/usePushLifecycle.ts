import { onNotificationNavigate, registerServiceWorker, syncPushSubscription, updatePresence } from "@/lib/push";
import { router } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";

// Signed in + paired: register the service worker (web), keep this device's
// push subscription fresh, record timezone + last seen (throttled), and follow
// notification taps while the app is already open. Native: presence only.
export function usePushLifecycle(active: boolean) {
  useEffect(() => {
    if (!active) return;
    registerServiceWorker();
    syncPushSubscription();
    updatePresence(true);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        updatePresence();
        syncPushSubscription();
      }
    });
    const off = onNotificationNavigate((url) => router.push(url as any));
    return () => {
      sub.remove();
      off();
    };
  }, [active]);
}
