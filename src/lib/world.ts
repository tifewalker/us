import { partnerHasAnswered } from "./activities";
import { localDateString } from "./dates";
import { supabase } from "./supabase";

// Counts that drive the beach's chapter (see components/beach/chapters.ts).
export async function getBeachCounts(coupleId: string) {
  const { count: memories, error: memErr } = await supabase
    .from("memories")
    .select("id", { count: "exact", head: true })
    .eq("couple_id", coupleId);
  if (memErr) throw memErr;

  // A day is "completed" when both partners answered. RLS only shows the
  // partner's row once *I've* answered, so "2 visible rows" = both answered.
  const { data: days, error: dayErr } = await supabase
    .from("daily_activities")
    .select("id, activity_responses(user_id)")
    .eq("couple_id", coupleId);
  if (dayErr) throw dayErr;
  const completedActivities = (days ?? []).filter(
    (d: any) => new Set((d.activity_responses ?? []).map((r: any) => r.user_id)).size >= 2,
  ).length;

  return { memories: memories ?? 0, completedActivities };
}

// Latest memory with its first photo (or first video's thumbnail) storage path.
export async function getLatestMemory(coupleId: string) {
  const { data, error } = await supabase
    .from("memories")
    .select("id, title, memory_date, created_at, memory_media(media_type, storage_path, thumbnail_path, created_at)")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "memory_media", ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const media = (data.memory_media ?? []) as any[];
  const photo = media.find((m) => m.media_type === "photo");
  const video = media.find((m) => m.media_type === "video" && m.thumbnail_path);
  return {
    id: data.id as string,
    title: data.title as string,
    imagePath: (photo?.storage_path ?? video?.thumbnail_path ?? null) as string | null,
  };
}

export type TodayStatus = "noPartner" | "fresh" | "yourTurn" | "waiting" | "revealed";

// Today's moment state for the note on the palm. Does NOT create today's
// activity (only visiting the Today screen does) — no row yet means "fresh".
export async function getTodayStatus(
  coupleId: string,
  myId: string,
  partnerJoined: boolean,
): Promise<TodayStatus> {
  if (!partnerJoined) return "noPartner";
  const { data: today, error } = await supabase
    .from("daily_activities")
    .select("id, activity_responses(user_id)")
    .eq("couple_id", coupleId)
    .eq("activity_date", localDateString())
    .maybeSingle();
  if (error) throw error;
  if (!today) return "fresh";
  const visible = new Set(((today as any).activity_responses ?? []).map((r: any) => r.user_id));
  const iAnswered = visible.has(myId);
  if (iAnswered && visible.size >= 2) return "revealed";
  if (iAnswered) return "waiting";
  return (await partnerHasAnswered(today.id)) ? "yourTurn" : "fresh";
}

export async function getWorld(coupleId: string) {
  const { data, error } = await supabase
    .from("couple_world")
    .select("chapter, unlocked_items")
    .eq("couple_id", coupleId)
    .maybeSingle();
  if (error) throw error;
  return data as { chapter: number | null; unlocked_items: string[] | null } | null;
}

export async function saveWorld(coupleId: string, chapter: number, unlockedItems: string[]) {
  const { error } = await supabase.from("couple_world").upsert(
    {
      couple_id: coupleId,
      chapter,
      unlocked_items: unlockedItems,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "couple_id" },
  );
  if (error) throw error;
}

// A memory my partner added in the last 3 days that I haven't written my side
// of yet — the beach pins a "what do you remember?" note on it.
export async function getRecentPartnerMemory(coupleId: string, partnerId: string, myId: string) {
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("memories")
    .select("id, title")
    .eq("couple_id", coupleId)
    .eq("created_by", partnerId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: mine } = await supabase
    .from("memory_reflections")
    .select("memory_id")
    .eq("memory_id", data.id)
    .eq("user_id", myId)
    .maybeSingle();
  return mine ? null : (data as { id: string; title: string });
}

// Everything "Remember when…" needs to pick and show a memory.
export async function getRememberPool(coupleId: string) {
  const { data, error } = await supabase
    .from("memories")
    .select("id, title, description, memory_date, created_at, song, memory_media(media_type, storage_path, thumbnail_path, created_at)")
    .eq("couple_id", coupleId)
    .order("created_at", { referencedTable: "memory_media", ascending: true });
  if (error) throw error;
  return (data ?? []).map((m: any) => {
    const media = (m.memory_media ?? []) as any[];
    const photo = media.find((x) => x.media_type === "photo");
    const video = media.find((x) => x.media_type === "video" && x.thumbnail_path);
    const [y, mo, d] = (m.memory_date ?? "").split("-").map(Number);
    return {
      id: m.id as string,
      title: m.title as string,
      description: (m.description ?? null) as string | null,
      created_at: m.created_at as string,
      date: m.memory_date ? new Date(y, mo - 1, d) : new Date(m.created_at),
      song: m.song ?? null,
      imagePath: (photo?.storage_path ?? video?.thumbnail_path ?? null) as string | null,
    };
  });
}
