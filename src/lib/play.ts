import AsyncStorage from "@react-native-async-storage/async-storage";
import { localDateString } from "./dates";
import { supabase } from "./supabase";
import type { VoiceNote } from "./voice";

// The Play tab (017): couple questions, secret missions, roulette, spicy mode
// and couple-made cards. Spicy content is filtered by the DATABASE unless both
// partners opted in (RLS on the card tables), so queries here never see it
// otherwise. Anything summarised outside its own screen uses SPICY_TEASER.

export const SPICY_TEASER = "Something spicy 🌶️";
// Stands in for the text of a voice-only answer (018: answer may be null when
// there's a voice note), so "answered?" checks and summaries keep working.
export const VOICE_ONLY = "🎙️";

// ---------------------------------------------------------------- spicy mode

export type SpicyState = { mine: boolean; partner: boolean; on: boolean };

export async function getSpicyState(coupleId: string, myId: string): Promise<SpicyState> {
  const { data, error } = await supabase.from("spicy_consents").select("user_id").eq("couple_id", coupleId);
  if (error) throw error;
  const ids = new Set((data ?? []).map((r) => r.user_id as string));
  const mine = ids.has(myId);
  const partner = [...ids].some((id) => id !== myId);
  return { mine, partner, on: mine && partner };
}

export async function setMySpicy(coupleId: string, myId: string, on: boolean) {
  const q = on
    ? supabase.from("spicy_consents").insert({ couple_id: coupleId, user_id: myId })
    : supabase.from("spicy_consents").delete().eq("couple_id", coupleId).eq("user_id", myId);
  const { error } = await q;
  if (error && error.code !== "23505") throw error;
}

// ---------------------------------------------------------------- cards

export type CardTable = "questions" | "mission_templates" | "roulette_challenges";
export type Card = { id: string; category: string; text: string; couple_id: string | null; duration?: string };

export const QUESTION_CATEGORIES = [
  { value: "know_you", label: "Know you" },
  { value: "deep", label: "Deep" },
  { value: "future", label: "Future" },
  { value: "would_you_rather", label: "Would you rather" },
  { value: "fun", label: "Fun" },
] as const;
export const MISSION_CATEGORIES = ["romantic", "funny", "deep", "chaotic", "flirty", "adventure", "long_distance"] as const;
export const ROULETTE_MOODS = ["easy", "romantic", "funny", "chaotic", "hard"] as const;

export function categoryLabel(c: string) {
  if (c === "spicy") return "Spicy 🌶️";
  if (c === "long_distance") return "Long distance";
  if (c === "would_you_rather") return "Would you rather";
  if (c === "know_you") return "Know you";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export async function getCards(table: CardTable, category?: string): Promise<Card[]> {
  const col = table === "roulette_challenges" ? "mood" : "category";
  let q = supabase.from(table).select(`id, text, couple_id, ${col}${table === "mission_templates" ? ", duration" : ""}`);
  if (category) q = q.eq(col, category);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, text: r.text, couple_id: r.couple_id, category: r[col], duration: r.duration }));
}

export async function addCustomCard(
  table: CardTable,
  fields: { coupleId: string; myId: string; text: string; category: string; duration?: string },
) {
  const col = table === "roulette_challenges" ? "mood" : "category";
  const row: Record<string, unknown> = { couple_id: fields.coupleId, created_by: fields.myId, text: fields.text, [col]: fields.category };
  if (table === "mission_templates") row.duration = fields.duration ?? "today";
  const { error } = await supabase.from(table).insert(row);
  if (error) throw error;
}

// ---------------------------------------------------------------- questions

export type Thread = {
  id: string;
  question: Card | null; // null when hidden by RLS (e.g. spicy while spicy is off)
  asked_by: string;
  created_at: string;
  myAnswer: string | null; // text, VOICE_ONLY for a voice-only answer, null = not answered
  theirAnswer: string | null; // only once I've answered (RLS)
  myVoice: unknown; // raw jsonb voice (asVoiceNote), or null
  theirVoice: unknown;
  partnerAnswered: boolean;
};

function answerOf(answers: any[] | null | undefined, pred: (a: any) => boolean) {
  const a = (answers ?? []).find(pred);
  if (!a) return { text: null as string | null, voice: null as unknown };
  return { text: (a.answer as string | null) ?? (a.voice ? VOICE_ONLY : null), voice: a.voice ?? null };
}

export async function getThreads(coupleId: string, myId: string): Promise<Thread[]> {
  const { data, error } = await supabase
    .from("question_threads")
    .select("id, asked_by, created_at, question:questions(id, category, text, couple_id), answers:question_answers(user_id, answer, voice)")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const threads = await Promise.all(
    (data ?? []).map(async (t: any) => {
      const me = answerOf(t.answers, (a) => a.user_id === myId);
      const them = answerOf(t.answers, (a) => a.user_id !== myId);
      const mine = me.text;
      const theirs = them.text;
      let partnerAnswered = !!theirs;
      if (!partnerAnswered && !mine) {
        const { data: yes } = await supabase.rpc("partner_has_answered_question", { target_thread_id: t.id });
        partnerAnswered = !!yes;
      }
      return {
        id: t.id,
        question: t.question ? { ...t.question } : null,
        asked_by: t.asked_by,
        created_at: t.created_at,
        myAnswer: mine,
        theirAnswer: theirs,
        myVoice: me.voice,
        theirVoice: them.voice,
        partnerAnswered,
      } as Thread;
    }),
  );
  // Threads whose question is hidden (spicy with spicy off) are hidden too.
  return threads.filter((t) => t.question);
}

// Ask = create the thread (one per question per couple; re-asking reopens it).
export async function askQuestion(coupleId: string, myId: string, questionId: string): Promise<string> {
  const { data, error } = await supabase
    .from("question_threads")
    .insert({ couple_id: coupleId, question_id: questionId, asked_by: myId })
    .select("id")
    .single();
  if (!error) return data.id as string;
  if (error.code !== "23505") throw error;
  const { data: existing, error: e2 } = await supabase
    .from("question_threads")
    .select("id")
    .eq("couple_id", coupleId)
    .eq("question_id", questionId)
    .single();
  if (e2) throw e2;
  return existing.id as string;
}

// Text, a voice note, or both (018). Voice files live at
// <couple>/questions/<thread>/<me>/… (hidden from my partner until they answer).
export async function answerQuestion(threadId: string, myId: string, answer: string | null, voice: VoiceNote | null = null) {
  const { error } = await supabase
    .from("question_answers")
    .upsert({ thread_id: threadId, user_id: myId, answer: answer?.trim() || null, voice }, { onConflict: "thread_id,user_id" });
  if (error) throw error;
}

export async function getThread(threadId: string, myId: string): Promise<Thread | null> {
  const { data, error } = await supabase
    .from("question_threads")
    .select("id, asked_by, created_at, question:questions(id, category, text, couple_id), answers:question_answers(user_id, answer, voice)")
    .eq("id", threadId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const t: any = data;
  const me = answerOf(t.answers, (a) => a.user_id === myId);
  const them = answerOf(t.answers, (a) => a.user_id !== myId);
  const mine = me.text;
  const theirs = them.text;
  let partnerAnswered = !!theirs;
  if (!partnerAnswered) {
    const { data: yes } = await supabase.rpc("partner_has_answered_question", { target_thread_id: t.id });
    partnerAnswered = !!yes;
  }
  return { id: t.id, question: t.question, asked_by: t.asked_by, created_at: t.created_at, myAnswer: mine, theirAnswer: theirs, myVoice: me.voice, theirVoice: them.voice, partnerAnswered };
}

// ---------------------------------------------------------------- missions

export type Mission = {
  id: string;
  assignee_id: string;
  template_id: string | null;
  mission_text: string;
  category: string;
  mission_date: string;
  reveal_at: string;
  completed_at: string | null;
  what_i_did: string | null;
  noticed: "noticed" | "no_idea" | null;
};
const MISSION_COLS = "id, assignee_id, template_id, mission_text, category, mission_date, reveal_at, completed_at, what_i_did, noticed";

// Local midnight at the END of the mission day.
export function revealAtFor(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d + 1, 0, 0, 0);
}

export async function getMyMission(coupleId: string, myId: string, date = localDateString()): Promise<Mission | null> {
  const { data, error } = await supabase
    .from("missions")
    .select(MISSION_COLS)
    .eq("couple_id", coupleId)
    .eq("assignee_id", myId)
    .eq("mission_date", date)
    .maybeSingle();
  if (error) throw error;
  return (data as Mission) ?? null;
}

// My partner's mission for a date — only returned once revealed (RLS).
export async function getPartnerMission(coupleId: string, myId: string, date: string): Promise<Mission | null> {
  const { data, error } = await supabase
    .from("missions")
    .select(MISSION_COLS)
    .eq("couple_id", coupleId)
    .neq("assignee_id", myId)
    .eq("mission_date", date)
    .maybeSingle();
  if (error) throw error;
  return (data as Mission) ?? null;
}

export async function partnerHasMissionToday(date = localDateString()) {
  const { data, error } = await supabase.rpc("partner_has_mission_today", { target_date: date });
  if (error) throw error;
  return !!data;
}

export async function drawMission(coupleId: string, myId: string, template: Card, existingId?: string): Promise<Mission> {
  const date = localDateString();
  const fields = {
    template_id: template.couple_id ? null : template.id,
    mission_text: template.text,
    category: template.category,
  };
  const q = existingId
    ? supabase.from("missions").update(fields).eq("id", existingId).select(MISSION_COLS).single()
    : supabase
        .from("missions")
        .insert({ couple_id: coupleId, assignee_id: myId, mission_date: date, reveal_at: revealAtFor(date).toISOString(), ...fields })
        .select(MISSION_COLS)
        .single();
  const { data, error } = await q;
  if (error) throw error;
  return data as Mission;
}

// Skip an unfinished mission (the spicy "Skip"): the row is deleted, so nothing is kept.
export async function skipMission(id: string) {
  const { error } = await supabase.from("missions").delete().eq("id", id);
  if (error) throw error;
}

export async function completeMission(id: string, whatIDid: string | null) {
  const { error } = await supabase.from("missions").update({ completed_at: new Date().toISOString(), what_i_did: whatIDid }).eq("id", id);
  if (error) throw error;
}

export async function setNoticed(id: string, noticed: "noticed" | "no_idea") {
  const { error } = await supabase.from("missions").update({ noticed }).eq("id", id);
  if (error) throw error;
}

// Every mission I can see (mine + revealed partner ones), newest first.
export async function getMissionHistory(coupleId: string): Promise<Mission[]> {
  const { data, error } = await supabase
    .from("missions")
    .select(MISSION_COLS)
    .eq("couple_id", coupleId)
    .order("mission_date", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []) as Mission[];
}

const redrawKey = (myId: string) => `play.redraw.${myId}.${localDateString()}`;
export async function hasRedrawnToday(myId: string) {
  try {
    return (await AsyncStorage.getItem(redrawKey(myId))) === "1";
  } catch {
    return false;
  }
}
export async function markRedrawn(myId: string) {
  try {
    await AsyncStorage.setItem(redrawKey(myId), "1");
  } catch {}
}

const missionRevealKey = (myId: string, date: string) => `play.missionReveal.${myId}.${date}`;
export async function hasSeenMissionReveal(myId: string, date: string) {
  try {
    return (await AsyncStorage.getItem(missionRevealKey(myId, date))) === "1";
  } catch {
    return false;
  }
}
export async function markMissionRevealSeen(myId: string, date: string) {
  try {
    await AsyncStorage.setItem(missionRevealKey(myId, date), "1");
  } catch {}
}

// ---------------------------------------------------------------- roulette

export type Spin = {
  id: string;
  spun_by: string;
  challenge_text: string;
  mood: string;
  created_at: string;
  done_at: string | null;
};

export async function recordSpin(coupleId: string, myId: string, card: Card, mood: string): Promise<Spin> {
  const { data, error } = await supabase
    .from("roulette_spins")
    .insert({ couple_id: coupleId, spun_by: myId, challenge_id: card.id, challenge_text: card.text, mood })
    .select("id, spun_by, challenge_text, mood, created_at, done_at")
    .single();
  if (error) throw error;
  return data as Spin;
}

export async function markSpinDone(id: string) {
  const { error } = await supabase.from("roulette_spins").update({ done_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function getRecentSpins(coupleId: string, limit = 12): Promise<Spin[]> {
  const { data, error } = await supabase
    .from("roulette_spins")
    .select("id, spun_by, challenge_text, mood, created_at, done_at")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Spin[];
}

// ---------------------------------------------------------------- summary (Play tab + tab-bar dot)

export type PlaySummary = {
  questionsWaitingForMe: number; // threads my partner asked that I haven't answered
  missionToday: Mission | null;
  partnerOnMission: boolean;
  unseenMissionReveal: boolean; // a partner mission revealed that I haven't looked at
};

export async function getPlaySummary(coupleId: string, myId: string): Promise<PlaySummary> {
  const today = localDateString();
  const yesterday = localDateString(new Date(Date.now() - 86_400_000));
  const [threads, mine, partnerOn, revealedYesterday, revealedToday] = await Promise.all([
    getThreads(coupleId, myId).catch(() => [] as Thread[]),
    getMyMission(coupleId, myId, today).catch(() => null),
    partnerHasMissionToday(today).catch(() => false),
    getPartnerMission(coupleId, myId, yesterday).catch(() => null),
    getPartnerMission(coupleId, myId, today).catch(() => null),
  ]);
  let unseen = false;
  for (const m of [revealedToday, revealedYesterday]) {
    if (m && !(await hasSeenMissionReveal(myId, m.mission_date))) unseen = true;
  }
  return {
    questionsWaitingForMe: threads.filter((t) => t.asked_by !== myId && !t.myAnswer).length,
    missionToday: mine,
    partnerOnMission: partnerOn,
    unseenMissionReveal: unseen,
  };
}
