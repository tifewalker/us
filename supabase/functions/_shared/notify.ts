// Shared by notify-event, notify-scheduled and notify-send.
//
// Web Push with jsr:@negrel/webpush (pure WebCrypto + fetch — RFC 8291
// message encryption + RFC 8292 VAPID), which runs on Supabase Edge (Deno).
//
// Every send goes through notify(), which applies the rules:
//   * category preferences (notification_prefs; missing row = all on)
//   * quiet hours in the recipient's timezone: events are queued (or, for
//     scheduled ones, held and retried) until quiet hours end; nudges are dropped
//   * nudges count against daily_nudge_cap (per local day)
//   * never the same kind + ref twice (notification_log unique)
// Copy never contains private content (answers, bottle/gift text); anything
// spicy uses NEUTRAL_SPICY.
import * as webpush from "jsr:@negrel/webpush@0.5.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export type Category = "partner_activity" | "bottles_gifts" | "dates" | "remember" | "nudges" | "system";

export type Message = {
  kind: string; // e.g. "activity_answered", "nudge_moment"
  refId: string; // what it's about (dedupe key together with kind)
  title: string;
  body?: string;
  url: string; // deep link inside the app, e.g. "/activity/today"
  category: Category;
};

export type Outcome = "sent" | "queued" | "held" | "dropped" | "duplicate" | "off" | "capped" | "no-devices";

export const NEUTRAL_SPICY = "Something's waiting for you 😏";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-notify-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Database → function calls carry the Vault secret in x-notify-secret.
export async function hasNotifySecret(admin: SupabaseClient, req: Request) {
  const candidate = req.headers.get("x-notify-secret");
  if (!candidate) return false;
  const { data, error } = await admin.rpc("check_notify_secret", { candidate });
  return !error && data === true;
}

// ---- time in the recipient's timezone ------------------------------------------

export type Local = { date: string; minutes: number; tz: string };

export function safeTz(tz: string | null | undefined) {
  try {
    if (tz) {
      new Intl.DateTimeFormat("en-CA", { timeZone: tz });
      return tz;
    }
  } catch { /* invalid → UTC */ }
  return "UTC";
}

export function localNow(tz: string, at = new Date()): Local {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(at).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute), tz };
}

// The UTC instant of local midnight at the start of `date` in `tz`.
export function localMidnightUtc(date: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const l = localNow(tz, new Date(guess));
  const [ly, lm, ld] = l.date.split("-").map(Number);
  const asUtc = Date.UTC(ly, lm - 1, ld) + l.minutes * 60_000;
  return new Date(guess - (asUtc - guess));
}

export function localDateOf(iso: string, tz: string) {
  return localNow(tz, new Date(iso)).date;
}

export function daysBetween(fromDate: string, toDate: string) {
  const [a, b, c] = fromDate.split("-").map(Number);
  const [x, y, z] = toDate.split("-").map(Number);
  return Math.round((Date.UTC(x, y - 1, z) - Date.UTC(a, b - 1, c)) / 86_400_000);
}

export const hm = (h: number, m = 0) => h * 60 + m;

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function inQuietHours(minutes: number, start: string, end: string) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === e) return false;
  return s < e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}

// Same FNV-1a as the app's seededUnit (components/ui/seeded.ts).
export function seededUnit(seed: string, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export function pick<T>(list: T[], seed: string) {
  return list[Math.floor(seededUnit(seed, 11) * list.length)] ?? list[0];
}

export const firstName = (name: string | null | undefined) => (name?.trim().split(/\s+/)[0]) || "Your person";

// ---- people ---------------------------------------------------------------------

export type Person = { id: string; name: string; tz: string; lastSeen: string | null };

export async function getPeople(admin: SupabaseClient, ids: string[]): Promise<Record<string, Person>> {
  const { data } = await admin.from("users").select("id, name, timezone, last_seen_at").in("id", ids.filter(Boolean));
  const out: Record<string, Person> = {};
  for (const u of data ?? []) out[u.id] = { id: u.id, name: firstName(u.name), tz: safeTz(u.timezone), lastSeen: u.last_seen_at };
  return out;
}

export async function partnerOf(admin: SupabaseClient, coupleId: string, userId: string): Promise<string | null> {
  const { data } = await admin.from("couples").select("partner_one, partner_two").eq("id", coupleId).maybeSingle();
  if (!data) return null;
  return data.partner_one === userId ? data.partner_two : data.partner_one;
}

// ---- Web Push -------------------------------------------------------------------

function b64urlDecode(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function b64urlEncode(b: Uint8Array) {
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let server: Promise<webpush.ApplicationServer> | null = null;
function appServer() {
  if (!server) {
    server = (async () => {
      const pub = b64urlDecode(Deno.env.get("VAPID_PUBLIC_KEY") ?? "");
      const d = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
      if (pub.length !== 65 || !d) throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY secrets are missing");
      const x = b64urlEncode(pub.slice(1, 33));
      const y = b64urlEncode(pub.slice(33, 65));
      const vapidKeys = await webpush.importVapidKeys({
        publicKey: { kty: "EC", crv: "P-256", x, y, ext: true },
        privateKey: { kty: "EC", crv: "P-256", x, y, d, ext: true },
      });
      return webpush.ApplicationServer.new({
        contactInformation: Deno.env.get("VAPID_SUBJECT") ?? "mailto:notifications@example.com",
        vapidKeys,
      });
    })();
    server.catch(() => (server = null));
  }
  return server;
}

// Push to every device of one person. Subscriptions the push service says are
// gone (404/410) are deleted; successes stamp last_success_at.
export async function deliver(admin: SupabaseClient, userId: string, msg: Message): Promise<number> {
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  if (!subs?.length) return 0;
  const as = await appServer();
  const payload = JSON.stringify({ title: msg.title, body: msg.body ?? "", url: msg.url, tag: `${msg.kind}:${msg.refId}` });
  let delivered = 0;
  for (const s of subs) {
    try {
      await as.subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }).pushTextMessage(payload, {
        ttl: 60 * 60 * 24,
        urgency: webpush.Urgency.Normal,
      });
      delivered++;
      await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).eq("id", s.id);
    } catch (e) {
      const status = e instanceof webpush.PushMessageError ? e.response.status : 0;
      if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("[push] failed", status, e instanceof webpush.PushMessageError ? await e.response.text().catch(() => "") : String(e));
    }
  }
  return delivered;
}

// ---- the rules -------------------------------------------------------------------

type Prefs = {
  partner_activity: boolean;
  bottles_gifts: boolean;
  dates: boolean;
  remember: boolean;
  nudges: boolean;
  quiet_start: string;
  quiet_end: string;
  daily_nudge_cap: number;
};
const DEFAULT_PREFS: Prefs = {
  partner_activity: true,
  bottles_gifts: true,
  dates: true,
  remember: true,
  nudges: true,
  quiet_start: "23:00",
  quiet_end: "08:00",
  daily_nudge_cap: 2,
};

async function prefsOf(admin: SupabaseClient, userId: string): Promise<Prefs> {
  const { data } = await admin.from("notification_prefs").select("*").eq("user_id", userId).maybeSingle();
  return { ...DEFAULT_PREFS, ...(data ?? {}) };
}

export async function notify(
  admin: SupabaseClient,
  person: Person,
  msg: Message,
  opts: { whenQuiet?: "queue" | "hold" } = {},
): Promise<Outcome> {
  const prefs = await prefsOf(admin, person.id);
  const nudge = msg.category === "nudges";
  if (msg.category !== "system" && !prefs[msg.category]) return "off";

  // No device yet → don't queue or log anything, so it can still be sent
  // once they turn notifications on (e.g. a bottle that's waiting).
  const { count: devices } = await admin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", person.id);
  if (!devices) return "no-devices";

  const local = localNow(person.tz);
  if (inQuietHours(local.minutes, prefs.quiet_start, prefs.quiet_end)) {
    if (nudge) return "dropped";
    if (opts.whenQuiet === "hold") return "held"; // scheduled: the next run tries again
    await admin.from("notification_queue").upsert(
      { user_id: person.id, kind: msg.kind, ref_id: msg.refId, payload: msg },
      { onConflict: "user_id,kind,ref_id", ignoreDuplicates: true },
    );
    return "queued";
  }

  if (nudge) {
    const { count } = await admin
      .from("notification_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", person.id)
      .like("kind", "nudge_%")
      .gte("sent_at", localMidnightUtc(local.date, person.tz).toISOString());
    if ((count ?? 0) >= prefs.daily_nudge_cap) return "capped";
  }

  // claim it first: a concurrent run can't send the same one twice
  const { data: claimed } = await admin
    .from("notification_log")
    .upsert({ user_id: person.id, kind: msg.kind, ref_id: msg.refId }, { onConflict: "user_id,kind,ref_id", ignoreDuplicates: true })
    .select("id");
  if (!claimed?.length) return "duplicate";

  const n = await deliver(admin, person.id, msg);
  return n > 0 ? "sent" : "no-devices";
}

// Deliver queued (quiet-hours) events for anyone whose quiet hours are over.
export async function flushQueue(admin: SupabaseClient) {
  const { data: rows } = await admin.from("notification_queue").select("id, user_id, payload").order("created_at").limit(200);
  if (!rows?.length) return 0;
  const people = await getPeople(admin, [...new Set(rows.map((r) => r.user_id))]);
  let sent = 0;
  for (const r of rows) {
    const person = people[r.user_id];
    if (!person) continue;
    const outcome = await notify(admin, person, r.payload as Message, { whenQuiet: "hold" });
    if (outcome === "held") continue; // still quiet
    await admin.from("notification_queue").delete().eq("id", r.id);
    if (outcome === "sent") sent++;
  }
  return sent;
}
