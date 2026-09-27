import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Web Push for the installed iPhone web app (021). Expo Go can't receive
// remote push (SDK 53+), so on native everything here is a no-op and Settings
// explains that notifications live in the home-screen web app.
//
// iOS rules: push only works in the installed (standalone) web app, iOS 16.4+,
// and Notification.requestPermission() must be called straight from a tap.

const isWeb = Platform.OS === "web";
const w = (globalThis as any).window as any;
const nav = (globalThis as any).navigator as any;

export type PushStatus =
  | "native" // Expo Go / native build — not supported here
  | "unsupported" // this browser has no Web Push
  | "needs-install" // iOS Safari tab: add to home screen first
  | "default" // can ask
  | "denied" // blocked in settings
  | "on"; // granted + subscribed

export function isIOS() {
  if (!isWeb || !nav) return false;
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
}

export function isStandalone() {
  if (!isWeb || !w) return false;
  return nav?.standalone === true || !!w.matchMedia?.("(display-mode: standalone)")?.matches;
}

function pushSupported() {
  return isWeb && !!w && "serviceWorker" in nav && "PushManager" in w && "Notification" in w;
}

function vapidKey(): Uint8Array<ArrayBuffer> {
  const s = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---- service worker --------------------------------------------------------------

let registration: Promise<any> | null = null;
export function registerServiceWorker() {
  if (!isWeb || !nav?.serviceWorker) return null;
  if (!registration) {
    registration = nav.serviceWorker.register("/sw.js", { scope: "/" }).catch((e: any) => {
      console.log("[push] service worker failed:", e?.message);
      registration = null;
      return null;
    });
  }
  return registration;
}

// Notification taps with the app already open: the service worker posts the
// deep link here and the app navigates with its router.
export function onNotificationNavigate(go: (url: string) => void) {
  if (!isWeb || !nav?.serviceWorker) return () => {};
  const handler = (e: any) => {
    if (e?.data?.type === "us:navigate" && typeof e.data.url === "string") go(e.data.url);
  };
  nav.serviceWorker.addEventListener("message", handler);
  return () => nav.serviceWorker.removeEventListener("message", handler);
}

// ---- status + subscribe ------------------------------------------------------------

export async function getPushStatus(): Promise<PushStatus> {
  if (!isWeb) return "native";
  if (isIOS() && !isStandalone()) return "needs-install";
  if (!pushSupported()) return "unsupported";
  const perm = w.Notification.permission as "default" | "denied" | "granted";
  if (perm === "denied") return "denied";
  if (perm === "default") return "default";
  const reg = await registerServiceWorker();
  const sub = await reg?.pushManager?.getSubscription?.().catch(() => null);
  return sub ? "on" : "default";
}

async function saveSubscription(sub: any) {
  const json = sub.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: nav?.userAgent ?? null,
  });
  if (error) throw error;
}

// Call straight from the tap: permission is requested before any await.
export async function enableNotifications(): Promise<PushStatus> {
  if (!pushSupported()) return getPushStatus();
  const permission = w.Notification.permission === "granted" ? Promise.resolve("granted") : w.Notification.requestPermission();
  const regPromise = registerServiceWorker();
  const result = await permission;
  if (result !== "granted") return result === "denied" ? "denied" : "default";
  const reg = await regPromise;
  if (!reg) throw new Error("Couldn't start notifications on this device.");
  await nav.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey() });
  await saveSubscription(sub);
  await AsyncStorage.setItem(PROMPT_KEY, "done").catch(() => {});
  return "on";
}

// Turn off on this device: unsubscribe in the browser + remove our row.
export async function disableNotifications() {
  const reg = await registerServiceWorker();
  const sub = await reg?.pushManager?.getSubscription?.();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

// On app open: if permission is granted, make sure this device's current
// subscription is saved (browsers can rotate it); re-subscribe if it vanished.
export async function syncPushSubscription() {
  try {
    if (!pushSupported() || w.Notification.permission !== "granted") return;
    if (isIOS() && !isStandalone()) return;
    const reg = await registerServiceWorker();
    if (!reg) return;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey() });
    await saveSubscription(sub);
  } catch (e: any) {
    console.log("[push] sync failed:", e?.message);
  }
}

// ---- timezone + last seen (throttled) ------------------------------------------------

let lastPresence = 0;
export async function updatePresence(force = false) {
  const now = Date.now();
  if (!force && now - lastPresence < 5 * 60_000) return;
  lastPresence = now;
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    await supabase.from("users").update({ timezone, last_seen_at: new Date().toISOString() }).eq("id", data.user.id);
  } catch (e: any) {
    console.log("[push] presence failed:", e?.message);
  }
}

// ---- app icon badge ----------------------------------------------------------------

export function setAppBadge(count: number) {
  if (!isWeb || !nav) return;
  try {
    if (count > 0) nav.setAppBadge?.(count)?.catch?.(() => {});
    else nav.clearAppBadge?.()?.catch?.(() => {});
  } catch {}
}

// ---- preferences -------------------------------------------------------------------

export type NotificationPrefs = {
  partner_activity: boolean;
  bottles_gifts: boolean;
  dates: boolean;
  remember: boolean;
  nudges: boolean;
  quiet_start: string; // "HH:MM:SS"
  quiet_end: string;
  daily_nudge_cap: number;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  partner_activity: true,
  bottles_gifts: true,
  dates: true,
  remember: true,
  nudges: true,
  quiet_start: "23:00:00",
  quiet_end: "08:00:00",
  daily_nudge_cap: 2,
};

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const { data } = await supabase.from("notification_prefs").select("*").eq("user_id", userId).maybeSingle();
  return { ...DEFAULT_PREFS, ...(data ?? {}) };
}

export async function saveNotificationPrefs(userId: string, prefs: NotificationPrefs) {
  const { error } = await supabase
    .from("notification_prefs")
    .upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

// ---- test / dev sends (only ever to yourself) ---------------------------------------

export const DEV_NOTIFICATION_KINDS = [
  "activity_answered",
  "both_answered",
  "question_asked",
  "spicy",
  "song_picked",
  "memory_added",
  "reflection_written",
  "missions_revealed",
  "bottle_arrived",
  "open_when_sent",
  "gift_countdown",
  "gift_ready",
  "birthday_soon",
  "birthday_today",
  "anniv_soon",
  "anniv_today",
  "recap_ready",
  "date_today",
  "remember",
  "nudge_moment",
  "nudge_song",
  "nudge_inactive",
];

export async function sendTestNotification(kind = "test"): Promise<number> {
  const { data, error } = await supabase.functions.invoke("notify-send", { body: { kind } });
  if (error) {
    let message = error.message;
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return data?.devices ?? 0;
}

// ---- the one-time "Want to know when {Name} replies?" card ---------------------------

const PROMPT_KEY = "push.prompt";

// Show it only where it can work (installed web app, not yet on/blocked) and
// only until it's been answered once.
export async function shouldOfferPush(): Promise<boolean> {
  if (!isWeb) return false;
  try {
    if ((await AsyncStorage.getItem(PROMPT_KEY)) === "done") return false;
  } catch {}
  const status = await getPushStatus();
  return status === "default";
}

export async function dismissPushOffer() {
  try {
    await AsyncStorage.setItem(PROMPT_KEY, "done");
  } catch {}
}
