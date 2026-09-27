import { signPaths, uploadMediaFile, type MediaRef, type MediaType } from "./memories";
import type { Song } from "./music";
import { supabase } from "./supabase";

// Sealed gifts = rows in `bottles` (014) with kind 'birthday'. RLS: the sender
// can do anything with their own; the recipient can only SELECT once
// unlock_at has passed, and only change opened_at. Media lives under
// <couple_id>/sealed/<bottle_id>/…, readable only via can_read_sealed().

export type Gift = {
  id: string;
  couple_id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  kind: "bottle" | "birthday" | "open_when";
  open_when_label: string | null;
  song: Song | null;
  media: MediaRef[];
  unlock_at: string | null;
  opened_at: string | null;
  created_at: string;
};

export const GIFT_COLS = "id, couple_id, sender_id, recipient_id, message, kind, open_when_label, song, media, unlock_at, opened_at, created_at";
const COLS = GIFT_COLS;

// "Something is waiting for you" — counts + earliest unlocks of MY locked
// bottles, without their content (security definer RPC, 015 shape).
export type Waiting = {
  count: number;
  nextUnlockAt: Date | null;
  kinds: string[];
  birthdayWaiting: number;
  nextBirthdayUnlockAt: Date | null;
  bottlesInTransit: number; // regular ocean bottles still drifting
};

export async function getWaitingForMe(coupleId: string): Promise<Waiting> {
  const { data, error } = await supabase.rpc("bottle_is_waiting", { target_couple_id: coupleId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    count: row?.waiting_count ?? 0,
    nextUnlockAt: row?.next_unlock_at ? new Date(row.next_unlock_at) : null,
    kinds: row?.kinds ?? [],
    birthdayWaiting: row?.birthday_waiting ?? 0,
    nextBirthdayUnlockAt: row?.next_birthday_unlock_at ? new Date(row.next_birthday_unlock_at) : null,
    bottlesInTransit: row?.bottles_in_transit ?? 0,
  };
}

// Birthday gifts addressed to me that are unlocked and not opened yet (RLS
// hides anything still locked, so this never returns sealed content).
export async function getUnopenedGiftsForMe(coupleId: string, myId: string): Promise<Gift[]> {
  const { data, error } = await supabase
    .from("bottles")
    .select(COLS)
    .eq("couple_id", coupleId)
    .eq("recipient_id", myId)
    .eq("kind", "birthday")
    .is("opened_at", null)
    .order("unlock_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Gift[];
}

// My most recent birthday gift for my partner (any state).
export async function getMyLatestGift(coupleId: string, myId: string): Promise<Gift | null> {
  const { data, error } = await supabase
    .from("bottles")
    .select(COLS)
    .eq("couple_id", coupleId)
    .eq("sender_id", myId)
    .eq("kind", "birthday")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as Gift) ?? null;
}

export async function getGift(id: string): Promise<Gift | null> {
  const { data, error } = await supabase.from("bottles").select(COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Gift) ?? null;
}

export async function saveGift(params: {
  id?: string;
  coupleId: string;
  senderId: string;
  recipientId: string;
  message: string;
  song: Song | null;
  unlockAt: Date;
}): Promise<Gift> {
  const fields = {
    message: params.message,
    song: params.song,
    unlock_at: params.unlockAt.toISOString(),
  };
  const q = params.id
    ? supabase.from("bottles").update(fields).eq("id", params.id).select(COLS).single()
    : supabase
        .from("bottles")
        .insert({ couple_id: params.coupleId, sender_id: params.senderId, recipient_id: params.recipientId, kind: "birthday", ...fields })
        .select(COLS)
        .single();
  const { data, error } = await q;
  if (error) throw error;
  return data as Gift;
}

// Upload one picked asset into the gift's sealed folder (sender only — storage
// policy can_write_sealed) and append it to the gift's media list.
export async function addGiftMedia(
  gift: Gift,
  asset: { uri: string; mediaType: MediaType; durationMs?: number | null; thumbnailUri?: string; mimeType?: string | null },
  onProgress?: (f: number) => void,
): Promise<MediaRef> {
  const ref = await uploadMediaFile({
    folder: `${gift.couple_id}/sealed/${gift.id}`,
    localUri: asset.uri,
    mediaType: asset.mediaType,
    durationMs: asset.durationMs,
    thumbnailUri: asset.thumbnailUri,
    mimeType: asset.mimeType,
    onProgress,
  });
  return ref;
}

export async function setGiftMedia(giftId: string, media: MediaRef[]) {
  const { error } = await supabase.from("bottles").update({ media }).eq("id", giftId);
  if (error) throw error;
}

// Remove one media item (files first, then the list).
export async function removeGiftMedia(gift: Gift, ref: MediaRef) {
  const paths = [ref.storage_path, ref.thumbnail_path].filter((p): p is string => !!p);
  const { error } = await supabase.storage.from("memory-media").remove(paths);
  if (error) throw error;
  const media = gift.media.filter((m) => m.storage_path !== ref.storage_path);
  await setGiftMedia(gift.id, media);
  return media;
}

export async function markGiftOpened(id: string) {
  const { error } = await supabase.from("bottles").update({ opened_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// Signed URLs for a gift's media (works only once readable — sender, or unlocked).
export async function signGiftMedia(media: MediaRef[]) {
  return signPaths(media.flatMap((m) => [m.storage_path, m.thumbnail_path ?? ""]), 3600);
}

// Local midnight at the start of the next occurrence of a birthday.
export function nextBirthdayUnlock(birthday: string, nextOccurrence: (d: string) => Date): Date {
  const n = nextOccurrence(birthday);
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0);
}
