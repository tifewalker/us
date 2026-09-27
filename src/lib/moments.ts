import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

// "Seen once" flags for special moments — per user, per device (AsyncStorage).
// A moment that fails to record as seen just plays again next time; never block on it.

const beginningKey = (userId: string) => `moments.beginning.${userId}`;
const revealKey = (userId: string, dailyActivityId: string) => `moments.reveal.${userId}.${dailyActivityId}`;

async function getFlag(key: string) {
  try {
    return (await AsyncStorage.getItem(key)) === "1";
  } catch {
    return false;
  }
}
async function setFlag(key: string) {
  try {
    await AsyncStorage.setItem(key, "1");
  } catch {}
}

export const hasSeenBeginning = (userId: string) => getFlag(beginningKey(userId));
export const markBeginningSeen = (userId: string) => setFlag(beginningKey(userId));

export const hasSeenReveal = (userId: string, dailyActivityId: string) => getFlag(revealKey(userId, dailyActivityId));
export const markRevealSeen = (userId: string, dailyActivityId: string) => setFlag(revealKey(userId, dailyActivityId));

// Welcome notes — one per person (welcome_notes, migration 014). The
// Beginning intro shows the note written by the OTHER partner.
export type WelcomeNote = { author_id: string; note: string; updated_at: string };

export async function getWelcomeNotes(coupleId: string): Promise<WelcomeNote[]> {
  const { data, error } = await supabase
    .from("welcome_notes")
    .select("author_id, note, updated_at")
    .eq("couple_id", coupleId);
  if (error) throw error;
  return (data ?? []) as WelcomeNote[];
}

// Upsert my note, or delete it when `note` is null.
export async function saveMyWelcomeNote(coupleId: string, authorId: string, note: string | null) {
  if (note === null) {
    const { error } = await supabase.from("welcome_notes").delete().eq("couple_id", coupleId).eq("author_id", authorId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("welcome_notes")
    .upsert({ couple_id: coupleId, author_id: authorId, note, updated_at: new Date().toISOString() }, { onConflict: "couple_id,author_id" });
  if (error) throw error;
}

// Birthday moment: once per birthday person per year.
const birthdayKey = (userId: string, year: number) => `moments.birthday.${userId}.${year}`;
export const hasSeenBirthday = (userId: string, year: number) => getFlag(birthdayKey(userId, year));
export const markBirthdaySeen = (userId: string, year: number) => setFlag(birthdayKey(userId, year));

// One-time "When's your birthday?" prompt on the Us tab.
const birthdayPromptKey = (userId: string) => `moments.birthdayPrompt.${userId}`;
export const hasDismissedBirthdayPrompt = (userId: string) => getFlag(birthdayPromptKey(userId));
export const dismissBirthdayPrompt = (userId: string) => setFlag(birthdayPromptKey(userId));

// Two perspectives reveal: once per user per memory.
const perspectiveKey = (userId: string, memoryId: string) => `moments.perspective.${userId}.${memoryId}`;
export const hasSeenPerspective = (userId: string, memoryId: string) => getFlag(perspectiveKey(userId, memoryId));
export const markPerspectiveSeen = (userId: string, memoryId: string) => setFlag(perspectiveKey(userId, memoryId));

// Two answers "match" when they're the same song, or the same words.
export function answersMatch(
  a: { response?: string | null; song?: { itunesId: number } | null } | null,
  b: { response?: string | null; song?: { itunesId: number } | null } | null,
): boolean {
  if (!a || !b) return false;
  if (a.song && b.song) return a.song.itunesId === b.song.itunesId;
  const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();
  const x = norm(a.response);
  const y = norm(b.response);
  if (!x || x === "📸" || x === "🎵" || x === "🎙️") return false; // photo / song / voice placeholders never "match" as text
  return x === y;
}
