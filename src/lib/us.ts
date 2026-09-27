import * as ImageManipulator from "expo-image-manipulator";
import type { Song } from "./music";
import { supabase } from "./supabase";
import { uploadLocalFile } from "./upload";

// The rest of the Us tab (020): How we met, Our favorites, Little things,
// Bucket list. All members-only by RLS; Little things are writable only by
// their owner.

// ---- How we met -----------------------------------------------------------------

export type Story = { story: string; photo_path: string | null; updated_by: string | null; updated_at: string };
export const MAX_STORY = 5000;

export async function getStory(coupleId: string): Promise<Story | null> {
  const { data, error } = await supabase.from("couple_story").select("story, photo_path, updated_by, updated_at").eq("couple_id", coupleId).maybeSingle();
  if (error) throw error;
  return (data as Story) ?? null;
}

// Upsert only the fields given (the other one keeps its value).
export async function saveStory(coupleId: string, myId: string, fields: { story?: string; photo_path?: string | null }) {
  const { error } = await supabase
    .from("couple_story")
    .upsert({ couple_id: coupleId, ...fields, updated_by: myId, updated_at: new Date().toISOString() }, { onConflict: "couple_id" });
  if (error) throw error;
}

// New photo → <couple>/story/…; the old file is removed after the row points at the new one.
export async function setStoryPhoto(coupleId: string, myId: string, localUri: string, oldPath: string | null) {
  const jpeg = await ImageManipulator.manipulateAsync(localUri, [{ resize: { width: 1200 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
  const path = await uploadLocalFile({ localUri: jpeg.uri, path: `${coupleId}/story/story-${Date.now()}.jpg` });
  await saveStory(coupleId, myId, { photo_path: path });
  if (oldPath) await supabase.storage.from("memory-media").remove([oldPath]).catch(() => {});
  return path;
}

// Storage first, then the pointer.
export async function removeStoryPhoto(coupleId: string, myId: string, path: string) {
  const { error } = await supabase.storage.from("memory-media").remove([path]);
  if (error) throw error;
  await saveStory(coupleId, myId, { photo_path: null });
}

// ---- Our favorites ----------------------------------------------------------------

export type FavoriteKind = "song" | "place" | "food" | "film" | "show" | "dessert" | "custom";
export type Favorite = { id: string; kind: FavoriteKind; label: string; value: string | null; song: Song | null; updated_by: string | null; updated_at: string };

export const FAVORITE_SUGGESTIONS: { kind: Exclude<FavoriteKind, "custom">; label: string; placeholder: string }[] = [
  { kind: "song", label: "Our song", placeholder: "" },
  { kind: "place", label: "Our place", placeholder: "The pier at sunset" },
  { kind: "food", label: "Our food", placeholder: "Suya from that stand" },
  { kind: "film", label: "Our film", placeholder: "The one we quote" },
  { kind: "show", label: "Our show", placeholder: "What we binge" },
  { kind: "dessert", label: "Our dessert", placeholder: "Two spoons, one bowl" },
];

export async function getFavorites(coupleId: string): Promise<Favorite[]> {
  const { data, error } = await supabase
    .from("couple_favorites")
    .select("id, kind, label, value, song, updated_by, updated_at")
    .eq("couple_id", coupleId)
    .order("updated_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Favorite[];
}

export async function saveFavorite(params: { id?: string; coupleId: string; myId: string; kind: FavoriteKind; label: string; value: string | null; song: Song | null }) {
  const row = {
    couple_id: params.coupleId,
    kind: params.kind,
    label: params.label.trim(),
    value: params.value?.trim() || null,
    song: params.kind === "song" ? params.song : null,
    updated_by: params.myId,
    updated_at: new Date().toISOString(),
  };
  const { error } = params.id
    ? await supabase.from("couple_favorites").update(row).eq("id", params.id)
    : await supabase.from("couple_favorites").upsert(row, { onConflict: "couple_id,kind,label" });
  if (error) {
    if (error.code === "23505") throw new Error(`You already have “${row.label}”.`);
    throw error;
  }
}

export async function deleteFavorite(id: string) {
  const { error } = await supabase.from("couple_favorites").delete().eq("id", id);
  if (error) throw error;
}

// ---- Little things about me --------------------------------------------------------

export type LittleThing = { id: string; user_id: string; label: string; value: string; updated_at: string };

export const LITTLE_THING_PROMPTS = [
  "Favorite flower",
  "Favorite color",
  "Favorite snack",
  "Favorite drink",
  "Perfume / cologne",
  "Ring size",
  "Shoe size",
  "Comfort food",
  "Dream destination",
  "Love language",
];

export async function getLittleThings(coupleId: string): Promise<LittleThing[]> {
  const { data, error } = await supabase
    .from("personal_favorites")
    .select("id, user_id, label, value, updated_at")
    .eq("couple_id", coupleId)
    .order("updated_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LittleThing[];
}

export async function saveLittleThing(coupleId: string, myId: string, label: string, value: string) {
  const { error } = await supabase
    .from("personal_favorites")
    .upsert(
      { couple_id: coupleId, user_id: myId, label: label.trim(), value: value.trim(), updated_at: new Date().toISOString() },
      { onConflict: "couple_id,user_id,label" },
    );
  if (error) throw error;
}

export async function deleteLittleThing(id: string) {
  const { error } = await supabase.from("personal_favorites").delete().eq("id", id);
  if (error) throw error;
}

// ---- Bucket list --------------------------------------------------------------------

export type BucketItem = {
  id: string;
  title: string;
  emoji: string | null;
  target_date: string | null;
  created_by: string;
  created_at: string;
  done_at: string | null;
  done_by: string | null;
  memory_id: string | null;
};

export const BUCKET_EMOJI = ["✈️", "🏔️", "🌅", "🏖️", "🍜", "🍷", "🎡", "🎶", "🎟️", "💃", "⛺", "🗼", "🌌", "🚗", "🐬", "💍"];
const COLS = "id, title, emoji, target_date, created_by, created_at, done_at, done_by, memory_id";

export async function getBucketList(coupleId: string): Promise<BucketItem[]> {
  const { data, error } = await supabase.from("bucket_items").select(COLS).eq("couple_id", coupleId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BucketItem[];
}

export async function addBucketItem(params: { coupleId: string; myId: string; title: string; emoji: string | null; targetDate: string | null }) {
  const { error } = await supabase.from("bucket_items").insert({
    couple_id: params.coupleId,
    title: params.title.trim(),
    emoji: params.emoji,
    target_date: params.targetDate,
    created_by: params.myId,
  });
  if (error) throw error;
}

export async function updateBucketItem(id: string, fields: { title: string; emoji: string | null; targetDate: string | null }) {
  const { error } = await supabase.from("bucket_items").update({ title: fields.title.trim(), emoji: fields.emoji, target_date: fields.targetDate }).eq("id", id);
  if (error) throw error;
}

export async function setBucketDone(id: string, myId: string, done: boolean) {
  const { error } = await supabase
    .from("bucket_items")
    .update(done ? { done_at: new Date().toISOString(), done_by: myId } : { done_at: null, done_by: null })
    .eq("id", id);
  if (error) throw error;
}

export async function linkBucketMemory(id: string, memoryId: string) {
  const { error } = await supabase.from("bucket_items").update({ memory_id: memoryId }).eq("id", id);
  if (error) throw error;
}

export async function deleteBucketItem(id: string) {
  const { error } = await supabase.from("bucket_items").delete().eq("id", id);
  if (error) throw error;
}
