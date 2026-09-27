import AsyncStorage from "@react-native-async-storage/async-storage";
import { localDateString, parseLocalDate, startOfToday } from "./dates";
import { supabase } from "./supabase";
import { uploadVoice, type LocalVoice } from "./voice";

// March 29 (really: relationship_start's month/day) — anniversary mode, the
// once-a-year moment and the "Our year" recap (022).
//
// Anniversary N = relationship_start + N years (local date; Feb 29 → Feb 28).
// The recap for year N covers [anniversary N-1, anniversary N) — for N = 1,
// from relationship_start itself.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function anniversaryDate(relationshipStart: string, n: number): Date {
  const start = parseLocalDate(relationshipStart);
  const y = start.getFullYear() + n;
  const m = start.getMonth();
  let d = start.getDate();
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  if (m === 1 && d === 29 && !leap) d = 28;
  return new Date(y, m, d);
}

// How many anniversaries have been reached (today counts), and whether today is one.
export function anniversaryStatus(relationshipStart: string, today = startOfToday()) {
  let reached = 0;
  while (anniversaryDate(relationshipStart, reached + 1) <= today) reached++;
  const isToday = reached > 0 && anniversaryDate(relationshipStart, reached).getTime() === today.getTime();
  return { reached, isToday, year: isToday ? reached : null };
}

// [from, to) for year N, as local midnights.
export function recapWindow(relationshipStart: string, n: number) {
  return { from: n <= 1 ? parseLocalDate(relationshipStart) : anniversaryDate(relationshipStart, n - 1), to: anniversaryDate(relationshipStart, n) };
}

// "29 March" (no year) — from relationship_start.
export function dayMonthLabel(relationshipStart: string) {
  const d = parseLocalDate(relationshipStart);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function monthName(i: number) {
  return MONTHS[i];
}

export function rangeLabel(from: Date, to: Date) {
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 1);
  const f = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
  return `${f(from)} – ${f(last)}`;
}

export function yearsLabel(n: number) {
  return n === 1 ? "1 year of us" : `${n} years of us`;
}

// ---- the once-a-year moment (per user, per year; AsyncStorage = localStorage on web) ----

const momentKey = (userId: string, year: number) => `moments.anniversary.${userId}.${year}`;

export async function hasSeenAnniversary(userId: string, year: number) {
  try {
    return (await AsyncStorage.getItem(momentKey(userId, year))) === "1";
  } catch {
    return false;
  }
}

export async function markAnniversarySeen(userId: string, year: number) {
  try {
    await AsyncStorage.setItem(momentKey(userId, year), "1");
  } catch {}
}

// ---- recap views (drives the 19:30 notification) ------------------------------------

export async function recordRecapView(coupleId: string, year: number) {
  const { error } = await supabase
    .from("anniversary_views")
    .upsert({ couple_id: coupleId, anniversary_year: year }, { onConflict: "user_id,couple_id,anniversary_year", ignoreDuplicates: true });
  if (error) console.log("[anniversary] view not recorded:", error.message);
}

// ---- "Where should our next chapter take us?" ----------------------------------------

export type AnniversaryAnswer = { user_id: string; answer: string | null; voice: unknown; created_at: string };

// Mine always; theirs only once I've answered (RLS, 022).
export async function getAnniversaryAnswers(coupleId: string, year: number): Promise<AnniversaryAnswer[]> {
  const { data, error } = await supabase
    .from("anniversary_answers")
    .select("user_id, answer, voice, created_at")
    .eq("couple_id", coupleId)
    .eq("anniversary_year", year);
  if (error) throw error;
  return (data ?? []) as AnniversaryAnswer[];
}

export async function partnerHasAnsweredAnniversary(year: number) {
  const { data, error } = await supabase.rpc("partner_has_answered_anniversary", { target_year: year });
  if (error) throw error;
  return !!data;
}

// Voice goes to <couple>/anniversary/<year>/<me>/… (locked until my partner answers).
export async function saveAnniversaryAnswer(params: { coupleId: string; myId: string; year: number; text: string | null; voice: LocalVoice | null }) {
  const note = params.voice ? await uploadVoice(`${params.coupleId}/anniversary/${params.year}/${params.myId}`, params.voice) : null;
  const { error } = await supabase.from("anniversary_answers").upsert(
    {
      couple_id: params.coupleId,
      anniversary_year: params.year,
      user_id: params.myId,
      answer: params.text?.trim() || null,
      voice: note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "couple_id,anniversary_year,user_id" },
  );
  if (error) throw error;
}

// ---- year stones (couple_world.unlocked_items: "yearStone:1", "yearStone:2", …) --------

export const YEAR_STONE_PREFIX = "yearStone:";

export function yearStonesFrom(items: string[] | null | undefined) {
  return (items ?? [])
    .filter((i) => i.startsWith(YEAR_STONE_PREFIX))
    .map((i) => Number(i.slice(YEAR_STONE_PREFIX.length)))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
}

export function yearStoneItems(reached: number) {
  return Array.from({ length: reached }, (_, i) => `${YEAR_STONE_PREFIX}${i + 1}`);
}

export const todayLocal = () => localDateString();
