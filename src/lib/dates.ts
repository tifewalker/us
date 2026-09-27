// The ONE "today" for every daily feature (daily activities, the beach's
// Today's-moment note, Our song today): the phone's LOCAL calendar date as
// 'YYYY-MM-DD'. Never use toISOString().slice(0, 10) for this — that's the UTC
// date, which flips at the wrong time (e.g. 1am in UTC+1 is still "yesterday").
export function localDateString(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 'YYYY-MM-DD' (a Postgres date) → local midnight Date. Never `new Date(s)`,
// which parses it as UTC and can shift the day.
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

const DAY = 24 * 60 * 60 * 1000;

// This year's (or next year's) occurrence of a yearly date, at local midnight.
// Feb 29 falls back to Feb 28 in non-leap years.
export function nextOccurrence(dateStr: string, from = startOfToday()): Date {
  const base = parseLocalDate(dateStr);
  const at = (year: number) => {
    const d = new Date(year, base.getMonth(), base.getDate());
    return d.getMonth() !== base.getMonth() ? new Date(year, base.getMonth() + 1, 0) : d;
  };
  let next = at(from.getFullYear());
  if (next < from) next = at(from.getFullYear() + 1);
  return next;
}

export function daysUntil(date: Date, from = startOfToday()): number {
  return Math.round((date.getTime() - from.getTime()) / DAY);
}

// Whole years from `dateStr` to its next occurrence (turns 25 / 3 years together).
export function yearsAtNext(dateStr: string): number {
  return nextOccurrence(dateStr).getFullYear() - parseLocalDate(dateStr).getFullYear();
}

export function isToday(dateStr: string): boolean {
  return daysUntil(nextOccurrence(dateStr)) === 0;
}

export function countdownLabel(days: number): string {
  if (days === 0) return "Today 🌸";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}
