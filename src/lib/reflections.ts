import { supabase } from "./supabase";

// Two perspectives (memory_reflections, 015). RLS: you always read your own;
// your partner's only once you've written yours (has_reflected). One per
// person per memory (unique memory_id, user_id).

export type Reflection = { user_id: string; text: string; updated_at: string | null };

export async function getReflections(memoryId: string): Promise<Reflection[]> {
  const { data, error } = await supabase
    .from("memory_reflections")
    .select("user_id, text, updated_at")
    .eq("memory_id", memoryId);
  if (error) throw error;
  return (data ?? []) as Reflection[];
}

export async function saveMyReflection(memoryId: string, userId: string, text: string) {
  const { error } = await supabase
    .from("memory_reflections")
    .upsert(
      { memory_id: memoryId, user_id: userId, text, updated_at: new Date().toISOString() },
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
