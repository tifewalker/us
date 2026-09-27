import type { Icon3DName } from "@/components/ui";
import { daysUntil, nextOccurrence, parseLocalDate, yearsAtNext } from "./dates";
import { supabase } from "./supabase";

// important_dates (014): birthdays (one per person, person_id set) and custom
// dates. The anniversary is NOT stored here — it's couples.relationship_start.

export type ImportantDate = {
  id: string;
  couple_id: string;
  type: "birthday" | "custom";
  label: string;
  date: string; // 'YYYY-MM-DD' (year included)
  person_id: string | null;
  emoji: string | null; // a 3D icon name
};

export async function getImportantDates(coupleId: string): Promise<ImportantDate[]> {
  const { data, error } = await supabase
    .from("important_dates")
    .select("id, couple_id, type, label, date, person_id, emoji")
    .eq("couple_id", coupleId);
  if (error) throw error;
  return (data ?? []) as ImportantDate[];
}

// One birthday per person (partial unique index) — update if it exists.
export async function saveBirthday(coupleId: string, personId: string, date: string, existingId?: string) {
  if (existingId) {
    const { error } = await supabase.from("important_dates").update({ date }).eq("id", existingId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("important_dates")
    .insert({ couple_id: coupleId, type: "birthday", person_id: personId, label: "Birthday", date, emoji: "cake" });
  if (error) throw error;
}

export async function saveCustomDate(
  coupleId: string,
  fields: { label: string; date: string; emoji: string },
  existingId?: string,
) {
  const q = existingId
    ? supabase.from("important_dates").update(fields).eq("id", existingId)
    : supabase.from("important_dates").insert({ couple_id: coupleId, type: "custom", ...fields });
  const { error } = await q;
  if (error) throw error;
}

export async function deleteImportantDate(id: string) {
  const { error } = await supabase.from("important_dates").delete().eq("id", id);
  if (error) throw error;
}

// ---- Upcoming list (Us tab, beach sign) -------------------------------------

export type UpcomingDate = {
  key: string;
  kind: "beginning" | "birthday" | "custom";
  label: string; // "The beginning" / "Ada's birthday" / "Our first trip"
  signLabel: string; // "our anniversary" / "Ada's birthday 🎂" / "Our first trip"
  icon: Icon3DName;
  date: string; // original date
  next: Date;
  days: number;
  line: string; // "3 years together" / "turns 25" / "2 years ago today"
  source?: ImportantDate;
  personId?: string;
};

export function buildUpcoming(
  relationshipStart: string,
  dates: ImportantDate[],
  nameOf: (personId: string) => string, // first name, or "You"
): UpcomingDate[] {
  const out: UpcomingDate[] = [];
  const years = (s: string) => yearsAtNext(s);

  const startNext = nextOccurrence(relationshipStart);
  const y0 = years(relationshipStart);
  out.push({
    key: "beginning",
    kind: "beginning",
    label: "The beginning",
    signLabel: "our anniversary",
    icon: "beach",
    date: relationshipStart,
    next: startNext,
    days: daysUntil(startNext),
    line: y0 <= 0 ? "Where it all started" : `${y0} ${y0 === 1 ? "year" : "years"} together`,
  });

  for (const d of dates) {
    const next = nextOccurrence(d.date);
    const n = years(d.date);
    if (d.type === "birthday" && d.person_id) {
      const who = nameOf(d.person_id);
      const label = who === "You" ? "Your birthday" : `${who}'s birthday`;
      out.push({
        key: d.id,
        kind: "birthday",
        label,
        signLabel: `${label} 🎂`,
        icon: "cake",
        date: d.date,
        next,
        days: daysUntil(next),
        line: n > 0 ? `turns ${n}` : "",
        source: d,
        personId: d.person_id,
      });
    } else {
      const days = daysUntil(next);
      out.push({
        key: d.id,
        kind: "custom",
        label: d.label,
        signLabel: d.label,
        icon: (d.emoji as Icon3DName) ?? "calendar",
        date: d.date,
        next,
        days,
        line: n <= 0 ? "The first one" : days === 0 ? `${n} ${n === 1 ? "year" : "years"} ago today` : `${n} ${n === 1 ? "year" : "years"} on`,
        source: d,
      });
    }
  }
  return out.sort((a, b) => a.days - b.days);
}

// The sign's line for the nearest date: "12 days until Ada's birthday 🎂",
// "Today: Our first trip", or "Happy anniversary 🌅" on the day itself.
export function signCountdown(next: UpcomingDate, daysOfUs: number): string {
  if (next.days === 0) {
    if (next.kind === "beginning") return daysOfUs > 0 ? "Happy anniversary 🌅" : "Where it all started";
    return `Today: ${next.signLabel}`;
  }
  return `${next.days} ${next.days === 1 ? "day" : "days"} until ${next.signLabel}`;
}

export function birthdayOf(dates: ImportantDate[], personId: string) {
  return dates.find((d) => d.type === "birthday" && d.person_id === personId) ?? null;
}

export function ageOn(birthday: string, on = new Date()) {
  const b = parseLocalDate(birthday);
  let age = on.getFullYear() - b.getFullYear();
  if (on.getMonth() < b.getMonth() || (on.getMonth() === b.getMonth() && on.getDate() < b.getDate())) age--;
  return age;
}
