import { nextOccurrence } from "./dates";
import { GIFT_COLS, type Gift } from "./gifts";
import type { Song } from "./music";
import { supabase } from "./supabase";

// Bottles in the ocean (015): `bottles` rows with kind 'bottle' (arrive at
// unlock_at) or 'open_when' (unlock_at null — the recipient opens one whenever
// its label fits). Same sealing rules as birthday gifts (014): the recipient's
// SELECT only returns a bottle once unlocked; media lives in the sealed folder.
// Birthday gifts (kind 'birthday') have their own flow and never show here.

export type Bottle = Gift;

export const OPEN_WHEN_LABELS = [
  "you miss me",
  "you can't sleep",
  "you're angry at me",
  "you need a laugh",
  "you need motivation",
  "you're proud of yourself",
];

export type ArrivalChoice =
  | "now"
  | "tonight"
  | "tomorrowMorning"
  | "week"
  | "month"
  | "anniversary"
  | "partnerBirthday"
  | "year"
  | "openWhen";

// Local times. "Tonight" = today 21:00 (tomorrow 21:00 if that's passed);
// "Tomorrow morning" = tomorrow 08:00; anniversary/birthday = 08:00 on the day.
export function arrivalDate(choice: ArrivalChoice, opts: { relationshipStart: string; partnerBirthday?: string | null }): Date | null {
  const now = new Date();
  const at = (d: Date, h: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0, 0);
  switch (choice) {
    case "now":
      return now;
    case "tonight": {
      const t = at(now, 21);
      return t > now ? t : at(new Date(now.getTime() + 86_400_000), 21);
    }
    case "tomorrowMorning":
      return at(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), 8);
    case "week":
      return new Date(now.getTime() + 7 * 86_400_000);
    case "month":
      return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes());
    case "anniversary": {
      const t = at(nextOccurrence(opts.relationshipStart), 8);
      return t > now ? t : at(nextOccurrence(opts.relationshipStart, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)), 8);
    }
    case "partnerBirthday": {
      if (!opts.partnerBirthday) return null;
      const t = at(nextOccurrence(opts.partnerBirthday), 8);
      return t > now ? t : at(nextOccurrence(opts.partnerBirthday, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)), 8);
    }
    case "year":
      return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
    case "openWhen":
      return null;
  }
}

export async function saveBottle(params: {
  id?: string;
  coupleId: string;
  senderId: string;
  recipientId: string;
  message: string;
  song: Song | null;
  kind: "bottle" | "open_when";
  unlockAt: Date | null;
  openWhenLabel: string | null;
}): Promise<Bottle> {
  const fields = {
    message: params.message,
    song: params.song,
    kind: params.kind,
    unlock_at: params.kind === "open_when" ? null : (params.unlockAt ?? new Date()).toISOString(),
    open_when_label: params.kind === "open_when" ? params.openWhenLabel : null,
  };
  const q = params.id
    ? supabase.from("bottles").update(fields).eq("id", params.id).select(GIFT_COLS).single()
    : supabase
        .from("bottles")
        .insert({ couple_id: params.coupleId, sender_id: params.senderId, recipient_id: params.recipientId, ...fields })
        .select(GIFT_COLS)
        .single();
  const { data, error } = await q;
  if (error) throw error;
  return data as Bottle;
}

// Take back (delete) a bottle before it's opened: sealed files first, then the row.
export async function takeBackBottle(b: Bottle) {
  const paths = (b.media ?? []).flatMap((m) => [m.storage_path, m.thumbnail_path]).filter((p): p is string => !!p);
  if (paths.length) {
    const { error } = await supabase.storage.from("memory-media").remove(paths);
    if (error) throw new Error(`Couldn't remove its photos: ${error.message}`);
  }
  const { data, error } = await supabase.from("bottles").delete().eq("id", b.id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Couldn't take it back — it may already be opened.");
}

const OCEAN_KINDS = ["bottle", "open_when"];

// Everything addressed to me that I can read (RLS: unlocked bottles + open-when).
export async function getReceivedBottles(coupleId: string, myId: string): Promise<Bottle[]> {
  const { data, error } = await supabase
    .from("bottles")
    .select(GIFT_COLS)
    .eq("couple_id", coupleId)
    .eq("recipient_id", myId)
    .in("kind", OCEAN_KINDS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Bottle[];
}

export async function getSentBottles(coupleId: string, myId: string): Promise<Bottle[]> {
  const { data, error } = await supabase
    .from("bottles")
    .select(GIFT_COLS)
    .eq("couple_id", coupleId)
    .eq("sender_id", myId)
    .in("kind", OCEAN_KINDS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Bottle[];
}

export function washedAshore(received: Bottle[]) {
  return received.filter((b) => b.kind === "bottle" && !b.opened_at);
}

export function openWhenNotes(received: Bottle[]) {
  return received.filter((b) => b.kind === "open_when");
}
