import { localDateString } from "./dates";
import type { Song } from "./music";
import { supabase } from "./supabase";

// "Our song today" — one pick per couple per day (daily_songs, migration 012).

export type DailySong = {
  id: string;
  couple_id: string;
  song_date: string;
  picked_by: string;
  song: Song;
  note: string | null;
  created_at: string;
  listens: { user_id: string; listened_at: string }[];
};

const SELECT = "id, couple_id, song_date, picked_by, song, note, created_at, listens:song_listens(user_id, listened_at)";

export async function getTodaySong(coupleId: string): Promise<DailySong | null> {
  const { data, error } = await supabase
    .from("daily_songs")
    .select(SELECT)
    .eq("couple_id", coupleId)
    .eq("song_date", localDateString())
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as DailySong) ?? null;
}

// First pick wins: a second insert for the same day hits the unique constraint
// (23505) — then we fetch and return the partner's pick instead.
export async function pickTodaySong(
  coupleId: string,
  userId: string,
  song: Song,
  note: string | null,
): Promise<{ song: DailySong; wonRace: boolean }> {
  const { error } = await supabase.from("daily_songs").insert({
    couple_id: coupleId,
    song_date: localDateString(),
    picked_by: userId,
    song,
    note,
  });
  if (error && error.code !== "23505") throw error;
  const today = await getTodaySong(coupleId);
  if (!today) throw new Error("Couldn't load today's song.");
  return { song: today, wonRace: !error };
}

export async function markListened(dailySongId: string, userId: string) {
  const { error } = await supabase.from("song_listens").insert({ daily_song_id: dailySongId, user_id: userId });
  if (error && error.code !== "23505") throw error; // already marked = fine
}

export async function getPastSongs(coupleId: string, limit = 20): Promise<DailySong[]> {
  const { data, error } = await supabase
    .from("daily_songs")
    .select(SELECT)
    .eq("couple_id", coupleId)
    .lt("song_date", localDateString())
    .order("song_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as DailySong[]) ?? [];
}

export type TodaySongStatus = "noPartner" | "none" | "partnerPicked" | "youPicked" | "bothListened";

export function todaySongStatus(
  today: DailySong | null,
  myId: string,
  partnerJoined: boolean,
): TodaySongStatus {
  if (!partnerJoined) return "noPartner";
  if (!today) return "none";
  if (new Set(today.listens.map((l) => l.user_id)).size >= 2) return "bothListened";
  return today.picked_by === myId ? "youPicked" : "partnerPicked";
}
