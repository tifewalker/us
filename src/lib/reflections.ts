import { supabase } from "./supabase";
import { asVoiceNote, uploadVoice, type LocalVoice } from "./voice";

// Two perspectives (memory_reflections, 015). RLS: you always read your own;
// your partner's only once you've written yours (has_reflected). One per
// person per memory (unique memory_id, user_id).

// text and/or a voice note (018: text may be null when there's a voice note).
export type Reflection = { user_id: string; text: string | null; voice: unknown; updated_at: string | null };

export async function getReflections(memoryId: string): Promise<Reflection[]> {
  const { data, error } = await supabase
    .from("memory_reflections")
    .select("user_id, text, voice, updated_at")
    .eq("memory_id", memoryId);
  if (error) throw error;
  return (data ?? []) as Reflection[];
}

// Saves my side. `voice`: a new recording to add/replace, "remove" to take the
// old one out, or undefined to keep whatever is there. Storage first: the new
// file is uploaded, the old one removed, then the row is written. The voice
// file lives at <couple>/reflections/<memory>/<me>/… so my partner can only
// read it once they've written theirs (018).
export async function saveMyReflection(params: {
  coupleId: string;
  memoryId: string;
  userId: string;
  text: string | null;
  voice?: LocalVoice | "remove";
  previousVoice?: unknown;
}) {
  const old = asVoiceNote(params.previousVoice);
  let next: unknown = params.previousVoice ?? null;
  let uploaded: string | null = null;
  if (params.voice && params.voice !== "remove") {
    const note = await uploadVoice(`${params.coupleId}/reflections/${params.memoryId}/${params.userId}`, params.voice);
    uploaded = note.storage_path;
    next = note;
  } else if (params.voice === "remove") {
    next = null;
  }
  if (old && params.voice) {
    const { error: rmError } = await supabase.storage.from("memory-media").remove([old.storage_path]);
    if (rmError) {
      if (uploaded) await supabase.storage.from("memory-media").remove([uploaded]).catch(() => {});
      throw new Error(`Couldn't remove your old voice note: ${rmError.message}`);
    }
  }
  const { error } = await supabase
    .from("memory_reflections")
    .upsert(
      { memory_id: params.memoryId, user_id: params.userId, text: params.text?.trim() || null, voice: next, updated_at: new Date().toISOString() },
      { onConflict: "memory_id,user_id" },
    );
  if (error) throw error;
}

export async function partnerHasReflected(memoryId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("partner_has_reflected", { target_memory_id: memoryId });
  if (error) throw error;
  return !!data;
}

// Memories where BOTH of us have written (for the journal's "2 sides" badge).
// Only memories I've reflected on can show 2 rows (RLS), which is exactly right.
export async function memoriesWithBothSides(memoryIds: string[]): Promise<Set<string>> {
  if (memoryIds.length === 0) return new Set();
  const { data, error } = await supabase.from("memory_reflections").select("memory_id, user_id").in("memory_id", memoryIds);
  if (error) throw error;
  const users = new Map<string, Set<string>>();
  for (const r of data ?? []) {
    if (!users.has(r.memory_id)) users.set(r.memory_id, new Set());
    users.get(r.memory_id)!.add(r.user_id);
  }
  return new Set([...users].filter(([, u]) => u.size >= 2).map(([id]) => id));
}
