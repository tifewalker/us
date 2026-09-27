import { parseLocalDate, startOfToday } from "./dates";
import { answersMatch } from "./moments";
import { supabase } from "./supabase";

// "Our stats" — counted in the app from what RLS lets you see, so it's always
// "what we both can see": a partner's unrevealed answer, unarrived bottle or
// unrevealed mission isn't counted until it's revealed. Reusable for the
// anniversary recap: `since` / `until` limit everything to [since, until) by
// created_at. The recap passes `excludeSpicy` so same-brain matches never
// count a spicy question.

export type CoupleStats = {
  daysTogether: number;
  memories: number;
  photos: number;
  videos: number;
  voiceNotes: number;
  songsPicked: number; // daily songs + songs on memories
  bottlesSent: { me: number; partner: number };
  questionsAnsweredTogether: number;
  sameBrain: number; // matching answers: daily activities + questions
  missionsCompleted: number;
  rouletteDone: number;
  bucketDone: number;
};

async function headCount(q: any): Promise<number> {
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function getCoupleStats(params: {
  coupleId: string;
  myId: string;
  relationshipStart: string; // YYYY-MM-DD
  since?: string; // ISO timestamp — only count things created at/after this
  until?: string; // ISO timestamp — …and before this
  excludeSpicy?: boolean;
}): Promise<CoupleStats> {
  const { coupleId, myId, since, until } = params;
  const after = <T,>(q: T): T => {
    let x: any = q;
    if (since) x = x.gte("created_at", since);
    if (until) x = x.lt("created_at", until);
    return x as T;
  };
  const head = { count: "exact" as const, head: true };

  const [memories, media, dailySongs, memorySongs, bottles, threads, days, missions, roulette, bucket] = await Promise.all([
    headCount(after(supabase.from("memories").select("id", head).eq("couple_id", coupleId))),
    after(supabase.from("memory_media").select("media_type, memories!inner(couple_id)").eq("memories.couple_id", coupleId)),
    headCount(after(supabase.from("daily_songs").select("id", head).eq("couple_id", coupleId))),
    headCount(after(supabase.from("memories").select("id", head).eq("couple_id", coupleId).not("song", "is", null))),
    after(supabase.from("bottles").select("sender_id").eq("couple_id", coupleId).in("kind", ["bottle", "open_when"])),
    after(supabase.from("question_threads").select("id, question:questions(category), answers:question_answers(user_id, answer)").eq("couple_id", coupleId)),
    after(supabase.from("daily_activities").select("id, activity_responses(user_id, response, song)").eq("couple_id", coupleId)),
    headCount(after(supabase.from("missions").select("id", head).eq("couple_id", coupleId).not("completed_at", "is", null))),
    headCount(after(supabase.from("roulette_spins").select("id", head).eq("couple_id", coupleId).not("done_at", "is", null))),
    headCount(after(supabase.from("bucket_items").select("id", head).eq("couple_id", coupleId).not("done_at", "is", null))),
  ]);

  const mediaRows = ((media as any).data ?? []) as { media_type: string }[];
  const bottleRows = ((bottles as any).data ?? []) as { sender_id: string }[];
  const threadRows = ((threads as any).data ?? []) as { question: { category: string } | null; answers: { user_id: string; answer: string | null }[] }[];
  const dayRows = ((days as any).data ?? []) as { activity_responses: { user_id: string; response: string | null; song: any }[] }[];

  let questionsTogether = 0;
  let sameBrain = 0;
  for (const t of threadRows) {
    const a = t.answers ?? [];
    if (new Set(a.map((x) => x.user_id)).size < 2) continue;
    questionsTogether++;
    if (params.excludeSpicy && t.question?.category === "spicy") continue;
    if (answersMatch({ response: a[0].answer }, { response: a[1].answer })) sameBrain++;
  }
  for (const d of dayRows) {
    const r = d.activity_responses ?? [];
    if (new Set(r.map((x) => x.user_id)).size < 2) continue;
    if (answersMatch(r[0], r[1])) sameBrain++;
  }

  return {
    daysTogether: Math.max(0, Math.round((startOfToday().getTime() - parseLocalDate(params.relationshipStart).getTime()) / 86_400_000)),
    memories,
    photos: mediaRows.filter((m) => m.media_type === "photo").length,
    videos: mediaRows.filter((m) => m.media_type === "video").length,
    voiceNotes: mediaRows.filter((m) => m.media_type === "voice").length,
    songsPicked: dailySongs + memorySongs,
    bottlesSent: {
      me: bottleRows.filter((b) => b.sender_id === myId).length,
      partner: bottleRows.filter((b) => b.sender_id !== myId).length,
    },
    questionsAnsweredTogether: questionsTogether,
    sameBrain,
    missionsCompleted: missions,
    rouletteDone: roulette,
    bucketDone: bucket,
  };
}
