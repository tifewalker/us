import { seededUnit } from "@/components/ui/seeded";
import { localDateString } from "./dates";
import { supabase } from "./supabase";

// "Remember when…" (015/016). At most one memory a day, only on some days.
// The day's pick is stored ONCE per couple in `remember_days` (016, insert-only):
// whoever opens the app first picks and inserts; the other phone reads that
// row (and on a unique-conflict race, re-reads the partner's pick). So both
// phones always show the same memory.

export type RememberCandidate = {
  id: string;
  title: string;
  description: string | null;
  date: Date; // memory_date, or created_at
  created_at: string;
};

const MIN_AGE_DAYS = 30;
const SKIP_DAYS = 60;
const DAY = 86_400_000;

// Roughly every 2nd–3rd day (deterministic per couple + date).
export function isRememberDay(coupleId: string, date = new Date()) {
  return seededUnit(`${coupleId}:${localDateString(date)}`, 7) < 0.4;
}

// The pure selection rule: prefer "on this day" (same day+month in a past
// year, then same day-of-month in a past month), else a seeded pick. Sorted by
// id so the choice is stable for a given seed.
function choose(pool: RememberCandidate[], seed: string, today: Date): RememberCandidate | null {
  if (pool.length === 0) return null;
  const onThisDay = pool.filter((m) => m.date.getDate() === today.getDate());
  const sameDayMonth = onThisDay.filter((m) => m.date.getMonth() === today.getMonth());
  const list = sameDayMonth.length ? sameDayMonth : onThisDay.length ? onThisDay : pool;
  const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
  return sorted[Math.floor(seededUnit(seed, 3) * sorted.length)] ?? null;
}

async function readDay(coupleId: string, day: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("remember_days")
    .select("memory_id")
    .eq("couple_id", coupleId)
    .eq("day", day)
    .maybeSingle();
  if (error) throw error;
  return (data?.memory_id as string) ?? null;
}

// Memories already picked in the last 60 days (from the table, shared by both phones).
async function recentlyPicked(coupleId: string, today: Date): Promise<Set<string>> {
  const since = localDateString(new Date(today.getTime() - SKIP_DAYS * DAY));
  const { data, error } = await supabase
    .from("remember_days")
    .select("memory_id")
    .eq("couple_id", coupleId)
    .gte("day", since);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.memory_id as string));
}

// Today's shared pick (reading or creating the remember_days row), or null.
// Dev options:
//  - `force`: ignores the remember-day and 30-day rules and picks locally
//    WITHOUT writing (phone-only; the table is insert-only by design, 016).
//  - `shareToday`: runs the REAL pick-and-save flow but ignores the schedule
//    and the 30-day rule, so the other phone reads the same row. If today
//    already has a row it's used as-is (it can't be replaced).
export async function getTodaysRemember(
  coupleId: string,
  memories: RememberCandidate[],
  { force = false, shareToday = false }: { force?: boolean; shareToday?: boolean } = {},
): Promise<RememberCandidate | null> {
  const today = new Date();
  const day = localDateString(today);
  const byId = new Map(memories.map((m) => [m.id, m]));

  if (force) {
    return choose(memories, `${coupleId}:${day}:dev`, today);
  }
  // A row for today always wins — even on a non-remember day (e.g. one saved
  // by the dev "shared" pick on the other phone).
  const existing = await readDay(coupleId, day);
  if (existing) return byId.get(existing) ?? null;
  if (!shareToday && !isRememberDay(coupleId, today)) return null;

  const recent = await recentlyPicked(coupleId, today);
  const cutoff = shareToday ? Infinity : today.getTime() - MIN_AGE_DAYS * DAY;
  const pool = memories.filter((m) => m.date.getTime() <= cutoff && !recent.has(m.id));
  const pick = choose(pool, `${coupleId}:${day}`, today);
  if (!pick) return null;

  const { error } = await supabase.from("remember_days").insert({ couple_id: coupleId, day, memory_id: pick.id });
  if (error) {
    if (error.code !== "23505") throw error;
    // My partner picked a moment before me — use theirs.
    const theirs = await readDay(coupleId, day);
    return theirs ? (byId.get(theirs) ?? null) : null;
  }
  return pick;
}

// "{N} months ago" / "{N} years ago today"
export function agoLabel(date: Date, today = new Date()) {
  const months = (today.getFullYear() - date.getFullYear()) * 12 + today.getMonth() - date.getMonth() - (today.getDate() < date.getDate() ? 1 : 0);
  const exactDay = today.getDate() === date.getDate();
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const sameMonth = today.getMonth() === date.getMonth();
    return `${years} ${years === 1 ? "year" : "years"} ago${exactDay && sameMonth ? " today" : ""}`;
  }
  if (months >= 1) return `${months} ${months === 1 ? "month" : "months"} ago${exactDay ? " today" : ""}`;
  const days = Math.max(0, Math.round((today.getTime() - date.getTime()) / DAY));
  return days === 0 ? "Today" : `${days} ${days === 1 ? "day" : "days"} ago`;
}

export async function getHeartsToday(memoryId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("remember_hearts")
    .select("user_id")
    .eq("memory_id", memoryId)
    .eq("remembered_on", localDateString());
  if (error) throw error;
  return (data ?? []).map((r) => r.user_id as string);
}

export async function heartToday(memoryId: string, userId: string) {
  const { error } = await supabase
    .from("remember_hearts")
    .insert({ memory_id: memoryId, user_id: userId, remembered_on: localDateString() });
  if (error && error.code !== "23505") throw error;
}
