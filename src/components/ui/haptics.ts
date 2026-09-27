import * as Haptics from "expo-haptics";

// Haptics are best-effort everywhere: on web, expo-haptics uses
// navigator.vibrate (Android) or iOS Safari's switch-toggle trick, and may do
// nothing at all. Never let a haptic break a tap — guard sync throws AND
// rejected promises.
function safe(run: () => Promise<void>) {
  try {
    run().catch(() => {});
  } catch {}
}

export function tapHaptic() {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function selectionHaptic() {
  safe(() => Haptics.selectionAsync());
}

export function successHaptic() {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}
