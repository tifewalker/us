import { getAnniversaryAnswers, rangeLabel, type AnniversaryAnswer } from "./anniversary";
import { localDateString } from "./dates";
import { signPaths } from "./memories";
import { answersMatch } from "./moments";
import type { Song } from "./music";
import { getCoupleStats, type CoupleStats } from "./stats";
import { supabase } from "./supabase";

// Everything "Our year" shows, for [from, to) in local dates. Only what RLS
// lets me see (so a partner's unrevealed answer, an unarrived bottle or a
// spicy card while spicy is off never appears), and same-brain examples skip
// spicy questions entirely. One signPaths() call for every image.

export type RecapPhoto = { memoryId: string; title: string; date: string; url: string | null; cacheKey: string | null };
export type RecapHighlight = RecapPhoto & { type: "photo" | "video"; videoUrl: string | null };
export type SameBrainExample = { prompt: string; mine: string; theirs: string };

export type Recap = {
  year: number | null; // null = dev preview (last 12 months)
  from: Date;
  to: Date;
  rangeText: string;
  partial: boolean; // our data starts well after the window does → "our year in Us"
  lastYear: { mine: AnniversaryAnswer | null; theirs: AnniversaryAnswer | null } | null;
  stats: CoupleStats;
  first: RecapPhoto | null;
  latest: RecapPhoto | null;
  busiest: { month: number; year: number; count: number; photos: RecapPhoto[] } | null;
  songs: { covers: Song[]; topArtist: string | null; soundtrack: Song | null };
  sameBrain: { count: number; examples: SameBrainExample[] };
  bucketDone: { title: string; emoji: string | null; doneAt: string }[];
  places: number;
  bothRemembered: RecapPhoto | null;
  highlights: RecapHighlight[];
};

type MediaRow = { id: string; media_type: string; storage_path: string; thumbnail_path: string | null; duration_seconds: number | null; created_at: string };
type MemRow = { id: string; title: string; memory_date: string | null; created_at: string; location: string | null; song: Song | null; memory_media: MediaRow[] };

const placeholders = new Set(["📸", "🎵", "🎙️"]);
const cleanText = (s: string | null | undefined) => (s && !placeholders.has(s.trim()) ? s.trim() : null);

export async function buildRecap(params: {
  coupleId: string;
  myId: string;
  relationshipStart: string;
  year: number | null;
  from: Date;
  to: Date;
}): Promise<Recap> {
  const { coupleId, myId, from, to, year } = params;
  const fromStr = localDateString(from);
  const toStr = localDateString(to);
  const inWindow = (d: string) => d >= fromStr && d < toStr;
  const localOf = (iso: string) => localDateString(new Date(iso));

  const [memRes, songRes, favRes, threadRes, dayRes, bucketRes, stats, lastYear] = await Promise.all([
    supabase
      .from("memories")
      .select("id, title, memory_date, created_at, location, song, memory_media(id, media_type, storage_path, thumbnail_path, duration_seconds, created_at)")
      .eq("couple_id", coupleId)
      .order("created_at", { referencedTable: "memory_media", ascending: true }),
    supabase.from("daily_songs").select("song, song_date").eq("couple_id", coupleId).gte("song_date", fromStr).lt("song_date", toStr),
    supabase.from("couple_favorites").select("song").eq("couple_id", coupleId).eq("kind", "song").not("song", "is", null).limit(1),
    supabase
      .from("question_threads")
      .select("created_at, question:questions(text, category), answers:question_answers(user_id, answer)")
      .eq("couple_id", coupleId)
      .gte("created_at", from.toISOString())
      .lt("created_at", to.toISOString()),
    supabase
      .from("daily_activities")
      .select("activity_date, activity:activities(title, category), activity_responses(user_id, response, song)")
      .eq("couple_id", coupleId)
      .gte("activity_date", fromStr)
      .lt("activity_date", toStr),
    supabase.from("bucket_items").select("title, emoji, done_at").eq("couple_id", coupleId).gte("done_at", from.toISOString()).lt("done_at", to.toISOString()),
    getCoupleStats({ coupleId, myId, relationshipStart: params.relationshipStart, since: from.toISOString(), until: to.toISOString(), excludeSpicy: true }),
    year && year >= 2 ? getAnniversaryAnswers(coupleId, year - 1).catch(() => []) : Promise.resolve(null),
  ]);

  // ---- memories in the window ----
  const memories = ((memRes.data ?? []) as MemRow[])
    .map((m) => ({ ...m, date: m.memory_date ?? localOf(m.created_at), media: (m.memory_media ?? []).filter((x) => x.media_type !== "voice") }))
    .filter((m) => inWindow(m.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const ids = memories.map((m) => m.id);

  const [reflRes, heartRes] = ids.length
    ? await Promise.all([
        supabase.from("memory_reflections").select("memory_id").in("memory_id", ids),
        supabase.from("remember_hearts").select("memory_id, user_id, remembered_on").in("memory_id", ids),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];
  const reflections = new Map<string, number>();
  for (const r of reflRes.data ?? []) reflections.set(r.memory_id, (reflections.get(r.memory_id) ?? 0) + 1);
  const hearts = new Map<string, Set<string>>();
  for (const h of heartRes.data ?? []) {
    if (!inWindow(h.remembered_on)) continue;
    if (!hearts.has(h.memory_id)) hearts.set(h.memory_id, new Set());
    hearts.get(h.memory_id)!.add(h.user_id);
  }

  const coverOf = (m: (typeof memories)[number]) => {
    const photo = m.media.find((x) => x.media_type === "photo");
    if (photo) return photo.storage_path;
    return m.media.find((x) => x.media_type === "video" && x.thumbnail_path)?.thumbnail_path ?? null;
  };
  const withCover = memories.filter((m) => coverOf(m));

  // ---- busiest month ----
  const byMonth = new Map<string, typeof memories>();
  for (const m of memories) {
    const k = m.date.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), m]);
  }
  let busiestKey: string | null = null;
  for (const [k, list] of byMonth) if (!busiestKey || list.length > byMonth.get(busiestKey)!.length) busiestKey = k;
  const busiestList = busiestKey && byMonth.get(busiestKey)!.length >= 2 ? byMonth.get(busiestKey)! : null;

  // ---- highlights: ~12, roughly one per month, best-scored first ----
  const score = (m: (typeof memories)[number]) => m.media.length + 2 * (reflections.get(m.id) ?? 0) + 2 * (hearts.get(m.id)?.size ?? 0);
  const picks = new Set<string>();
  for (const [, list] of byMonth) {
    const best = list.filter((m) => m.media.length).sort((a, b) => score(b) - score(a))[0];
    if (best) picks.add(best.id);
  }
  for (const m of [...memories].filter((x) => x.media.length).sort((a, b) => score(b) - score(a))) {
    if (picks.size >= 12) break;
    picks.add(m.id);
  }
  const highlightMems = memories.filter((m) => picks.has(m.id)).slice(0, 12);

  const both = memories.find((m) => (hearts.get(m.id)?.size ?? 0) >= 2 && coverOf(m)) ?? null;

  // ---- one batch of signed URLs ----
  const paths = new Set<string>();
  const add = (p: string | null | undefined) => p && paths.add(p);
  withCover.slice(0, 1).forEach((m) => add(coverOf(m)));
  withCover.slice(-1).forEach((m) => add(coverOf(m)));
  (busiestList ?? []).slice(0, 4).forEach((m) => add(coverOf(m)));
  if (both) add(coverOf(both));
  for (const m of highlightMems) {
    const item = m.media[0];
    add(item.media_type === "photo" ? item.storage_path : item.thumbnail_path);
    if (item.media_type === "video" && (item.duration_seconds ?? 99) <= 60) add(item.storage_path);
  }
  const urls = await signPaths([...paths], 3600).catch(() => ({}) as Record<string, string>);
  const photoOf = (m: (typeof memories)[number]): RecapPhoto => {
    const p = coverOf(m);
    return { memoryId: m.id, title: m.title, date: m.date, url: p ? (urls[p] ?? null) : null, cacheKey: p };
  };

  // ---- songs ----
  const songs: Song[] = [];
  const seen = new Set<number>();
  const counts = new Map<number, number>();
  const push = (s: Song | null | undefined) => {
    if (!s?.itunesId) return;
    counts.set(s.itunesId, (counts.get(s.itunesId) ?? 0) + 1);
    if (!seen.has(s.itunesId)) {
      seen.add(s.itunesId);
      songs.push(s);
    }
  };
  for (const r of songRes.data ?? []) push(r.song as Song);
  for (const m of memories) push(m.song);
  const artistCounts = new Map<string, number>();
  for (const s of songs) artistCounts.set(s.artist, (artistCounts.get(s.artist) ?? 0) + (counts.get(s.itunesId) ?? 1));
  const topArtist = [...artistCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const favorite = (favRes.data?.[0]?.song as Song | undefined) ?? null;
  const mostPicked = [...songs].sort((a, b) => (counts.get(b.itunesId) ?? 0) - (counts.get(a.itunesId) ?? 0))[0] ?? null;
  const soundtrack = [favorite, mostPicked].find((s) => s?.previewUrl) ?? null;

  // ---- same brain (non-spicy, revealed only) ----
  const examples: SameBrainExample[] = [];
  let sameCount = 0;
  for (const t of (threadRes.data ?? []) as any[]) {
    if (t.question?.category === "spicy") continue;
    const a = (t.answers ?? []) as { user_id: string; answer: string | null }[];
    const mine = a.find((x) => x.user_id === myId);
    const theirs = a.find((x) => x.user_id !== myId);
    if (!mine || !theirs) continue;
    if (!answersMatch({ response: mine.answer }, { response: theirs.answer })) continue;
    sameCount++;
    const m = cleanText(mine.answer);
    const th = cleanText(theirs.answer);
    if (examples.length < 2 && m && th && t.question?.text) examples.push({ prompt: t.question.text, mine: m, theirs: th });
  }
  for (const d of (dayRes.data ?? []) as any[]) {
    const r = (d.activity_responses ?? []) as { user_id: string; response: string | null; song: any }[];
    const mine = r.find((x) => x.user_id === myId);
    const theirs = r.find((x) => x.user_id !== myId);
    if (!mine || !theirs || !answersMatch(mine, theirs)) continue;
    sameCount++;
    const m = cleanText(mine.response) ?? mine.song?.title ?? null;
    const th = cleanText(theirs.response) ?? theirs.song?.title ?? null;
    if (examples.length < 2 && m && th && d.activity?.title) examples.push({ prompt: d.activity.title, mine: m, theirs: th });
  }

  // ---- places ----
  const places = new Set(memories.map((m) => m.location?.trim().toLowerCase()).filter((x): x is string => !!x)).size;

  // ---- how much of the window our data covers ----
  const firstData = [memories[0]?.date, ...((dayRes.data ?? []) as any[]).map((d) => d.activity_date)].filter(Boolean).sort()[0] as string | undefined;
  const partial = !firstData || (new Date(firstData).getTime() - from.getTime()) / 86_400_000 > 30;

  return {
    year,
    from,
    to,
    rangeText: rangeLabel(from, to),
    partial,
    lastYear: lastYear
      ? { mine: lastYear.find((a) => a.user_id === myId) ?? null, theirs: lastYear.find((a) => a.user_id !== myId) ?? null }
      : null,
    stats,
    first: withCover.length ? photoOf(withCover[0]) : null,
    latest: withCover.length > 1 ? photoOf(withCover[withCover.length - 1]) : null,
    busiest: busiestList && busiestKey
      ? { month: Number(busiestKey.slice(5, 7)) - 1, year: Number(busiestKey.slice(0, 4)), count: busiestList.length, photos: busiestList.filter((m) => coverOf(m)).slice(0, 4).map(photoOf) }
      : null,
    songs: { covers: songs.filter((s) => s.artworkUrl).slice(0, 12), topArtist, soundtrack },
    sameBrain: { count: sameCount, examples },
    bucketDone: ((bucketRes.data ?? []) as any[]).map((b) => ({ title: b.title, emoji: b.emoji, doneAt: b.done_at })),
    places,
    bothRemembered: both ? photoOf(both) : null,
    highlights: highlightMems.map((m) => {
      const item = m.media[0];
      const thumb = item.media_type === "photo" ? item.storage_path : item.thumbnail_path;
      return {
        memoryId: m.id,
        title: m.title,
        date: m.date,
        type: item.media_type === "video" ? "video" : "photo",
        url: thumb ? (urls[thumb] ?? null) : null,
        cacheKey: thumb,
        videoUrl: item.media_type === "video" ? (urls[item.storage_path] ?? null) : null,
      } as RecapHighlight;
    }),
  };
}
