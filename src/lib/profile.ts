import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useSyncExternalStore } from "react";
import { getMyCouple } from "./couples";
import { signPaths } from "./memories";
import { supabase } from "./supabase";
import { uploadLocalFile } from "./upload";

// Profiles (020): users.name + users.avatar_path. Avatars live at
// <couple_id>/avatars/<user_id>/<file> — both of you can read them, only the
// owner can upload/replace/delete (storage policies).

export type Profile = {
  id: string;
  name: string | null;
  firstName: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
};

const first = (n: string | null) => (n ? (n.trim().split(/\s+/)[0] ?? null) : null);

export async function getProfiles(ids: string[]): Promise<Record<string, Profile>> {
  const want = ids.filter(Boolean);
  if (want.length === 0) return {};
  const { data, error } = await supabase.from("users").select("id, name, avatar_path").in("id", want);
  if (error) throw error;
  const urls = await signPaths((data ?? []).map((u: any) => u.avatar_path).filter(Boolean), 3600).catch(() => ({}) as Record<string, string>);
  const out: Record<string, Profile> = {};
  for (const u of data ?? []) {
    out[u.id] = {
      id: u.id,
      name: u.name ?? null,
      firstName: first(u.name ?? null),
      avatarPath: u.avatar_path ?? null,
      avatarUrl: u.avatar_path ? (urls[u.avatar_path] ?? null) : null,
    };
  }
  return out;
}

export async function updateMyName(userId: string, name: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) throw new Error("Your name can't be empty.");
  if (clean.length > 60) throw new Error("That's a long name — keep it under 60 characters.");
  const { error } = await supabase.from("users").update({ name: clean }).eq("id", userId);
  if (error) throw error;
  refreshCoupleProfiles();
}

// Pick a photo, crop it square (the picker's editor on iOS; a centre crop
// everywhere, so web gets a square too), shrink to 512px JPEG, upload, point
// users.avatar_path at it, then remove the old file. Returns false if cancelled.
export async function pickAndUploadAvatar(coupleId: string, userId: string, oldPath: string | null): Promise<boolean> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("Allow photo access to choose a profile photo.");
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
  if (result.canceled) return false;
  const asset = result.assets[0];
  const w = asset.width || 0;
  const h = asset.height || 0;
  const actions: ImageManipulator.Action[] = [];
  if (w > 0 && h > 0 && w !== h) {
    const side = Math.min(w, h);
    actions.push({ crop: { originX: Math.floor((w - side) / 2), originY: Math.floor((h - side) / 2), width: side, height: side } });
  }
  actions.push({ resize: { width: 512, height: 512 } });
  const square = await ImageManipulator.manipulateAsync(asset.uri, actions, { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
  const path = await uploadLocalFile({ localUri: square.uri, path: `${coupleId}/avatars/${userId}/avatar-${Date.now()}.jpg` });
  const { error } = await supabase.from("users").update({ avatar_path: path }).eq("id", userId);
  if (error) {
    await supabase.storage.from("memory-media").remove([path]).catch(() => {});
    throw error;
  }
  if (oldPath && oldPath !== path) await supabase.storage.from("memory-media").remove([oldPath]).catch(() => {});
  refreshCoupleProfiles();
  return true;
}

// Storage first: the file goes, then the pointer.
export async function removeAvatar(userId: string, path: string) {
  const { error: rmError } = await supabase.storage.from("memory-media").remove([path]);
  if (rmError) throw rmError;
  const { error } = await supabase.from("users").update({ avatar_path: null }).eq("id", userId);
  if (error) throw error;
  refreshCoupleProfiles();
}

// ---- "Delete our world" (Edge Function delete-world) ------------------------

export const DELETE_WORLD_PHRASE = "delete our world";

export type DeleteWorldResult = { ok: true; memories: number; bottles_and_gifts: number; days_answered: number; files: number };

export async function deleteWorld(coupleId: string): Promise<DeleteWorldResult> {
  const { data, error } = await supabase.functions.invoke("delete-world", {
    body: { couple_id: coupleId, confirm: DELETE_WORLD_PHRASE },
  });
  if (error) {
    // FunctionsHttpError: the function's own { error } message is in the response body
    let message = error.message;
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  if (!data?.ok) throw new Error(data?.error ?? "Something went wrong.");
  return data as DeleteWorldResult;
}

// ---- Both of us, cached for the session (Settings, Us, reveal envelopes) ------

type CoupleProfiles = { me: Profile | null; partner: Profile | null; coupleId: string | null };
let cache: CoupleProfiles = { me: null, partner: null, coupleId: null };
let loading: Promise<void> | null = null;
let loaded = false;
const listeners = new Set<() => void>();

async function loadCoupleProfiles() {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const myId = auth.user?.id;
    if (!myId) return;
    const couple = await getMyCouple();
    const partnerId = couple ? (couple.partner_one === myId ? couple.partner_two : couple.partner_one) : null;
    const profiles = await getProfiles([myId, partnerId ?? ""]);
    cache = { me: profiles[myId] ?? null, partner: partnerId ? (profiles[partnerId] ?? null) : null, coupleId: couple?.id ?? null };
    loaded = true;
    listeners.forEach((l) => l());
  } catch (e: any) {
    console.log("[profile] load failed:", e?.message);
  } finally {
    loading = null;
  }
}

export function refreshCoupleProfiles() {
  if (!loading) loading = loadCoupleProfiles();
  return loading;
}

// Clears the cache (sign out / delete world) so the next account starts fresh.
export function resetCoupleProfiles() {
  cache = { me: null, partner: null, coupleId: null };
  loaded = false;
  listeners.forEach((l) => l());
}

export function useCoupleProfiles(): CoupleProfiles {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => cache,
  );
  useEffect(() => {
    if (!loaded) refreshCoupleProfiles();
  }, []);
  return snapshot;
}
