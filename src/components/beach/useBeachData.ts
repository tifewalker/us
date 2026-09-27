import { anniversaryStatus, yearStoneItems, yearStonesFrom } from "@/lib/anniversary";
import { getCurrentUser, getUserName } from "@/lib/auth";
import { getMyCouple } from "@/lib/couples";
import { isToday, parseLocalDate, startOfToday } from "@/lib/dates";
import { getUnopenedGiftsForMe, getWaitingForMe } from "@/lib/gifts";
import {
    ageOn,
    buildUpcoming,
    getImportantDates,
    signCountdown,
    type ImportantDate,
    type UpcomingDate,
} from "@/lib/importantDates";
import { getSignedMediaUrl } from "@/lib/memories";
import { getWelcomeNotes } from "@/lib/moments";
import { getTodaySong, todaySongStatus, type TodaySongStatus } from "@/lib/songs";
import { getReceivedBottles, openWhenNotes, washedAshore } from "@/lib/bottles";
import {
    getBeachCounts,
    getRecentPartnerMemory,
    getRememberPool,
    getLatestMemory,
    getTodayStatus,
    getWorld,
    saveWorld,
    type TodayStatus,
} from "@/lib/world";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { chapterFor, unlockedItems, type ChapterNumber } from "./chapters";

export type BeachData = {
  userId: string;
  coupleId: string;
  firstName: string | null;
  relationshipStart: string; // 'YYYY-MM-DD'
  inviteCode: string | null; // set only while partner_two is null
  partnerJoined: boolean;
  memoryCount: number;
  completedActivities: number;
  latestMemory: { id: string; title: string; imageUrl: string | null; imagePath: string | null } | null;
  today: TodayStatus;
  partnerId: string | null;
  partnerFirstName: string | null;
  welcomeNoteFromPartner: string | null; // shown in the Beginning intro
  todaySong: TodaySongStatus;
  chapter: ChapterNumber;
  dates: ImportantDate[];
  nextDate: UpcomingDate; // nearest upcoming (anniversary / birthday / custom)
  signCountdown: string;
  birthdayToday: { personId: string; name: string; age: number } | null; // local date
  giftWaiting: { count: number; nextUnlockAt: Date } | null; // locked gifts for me (no content)
  unlockedGiftId: string | null; // an unlocked, unopened birthday gift for me
  bottlesInTransit: number; // ocean bottles drifting my way (count only)
  washedBottleIds: string[]; // arrived, unopened ocean bottles for me
  jar: { total: number; unopened: number }; // my open-when notes
  newMemoryFromPartner: { id: string; title: string } | null; // last 3 days, I haven't written my side
  rememberPool: Awaited<ReturnType<typeof getRememberPool>>;
  anniversary: { isToday: boolean; year: number | null; reached: number }; // local date
  yearStones: number; // stones on the beach (one per anniversary reached; permanent)
};

// Everything the beach needs, refreshed every time Home gains focus (so a new
// memory or answer shows up on return). Also persists chapter progress to
// couple_world when it grows.
export function useBeachData() {
  const [data, setData] = useState<BeachData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      const couple = await getMyCouple();
      if (!couple) throw new Error("Couldn't find your world.");

      const partnerJoined = !!couple.partner_two;
      const partnerId = couple.partner_one === user.id ? couple.partner_two : couple.partner_one;
      const [name, partnerName, song, counts, latest, today, world, dates, notes, waiting, unopened, received, recentPartner, rememberPool] = await Promise.all([
        getUserName(user.id),
        partnerId ? getUserName(partnerId).catch(() => null) : Promise.resolve(null),
        partnerJoined ? getTodaySong(couple.id).catch(() => null) : Promise.resolve(null),
        getBeachCounts(couple.id),
        getLatestMemory(couple.id),
        getTodayStatus(couple.id, user.id, partnerJoined),
        getWorld(couple.id).catch(() => null),
        getImportantDates(couple.id).catch(() => [] as ImportantDate[]),
        getWelcomeNotes(couple.id).catch(() => []),
        partnerJoined ? getWaitingForMe(couple.id).catch(() => null) : Promise.resolve(null),
        partnerJoined ? getUnopenedGiftsForMe(couple.id, user.id).catch(() => []) : Promise.resolve([]),
        partnerJoined ? getReceivedBottles(couple.id, user.id).catch(() => []) : Promise.resolve([]),
        partnerId ? getRecentPartnerMemory(couple.id, partnerId, user.id).catch(() => null) : Promise.resolve(null),
        getRememberPool(couple.id).catch(() => []),
      ]);
      const jarNotes = openWhenNotes(received);
      const first = (n: string | null) => (n ? n.trim().split(/\s+/)[0] : null);
      const myFirst = first(name);
      const partnerFirst = first(partnerName);
      const nameOf = (id: string) => (id === user.id ? "You" : (partnerFirst ?? "Your partner"));
      const upcoming = buildUpcoming(couple.relationship_start, dates, nameOf);
      const bdayToday = dates.find((d) => d.type === "birthday" && d.person_id && isToday(d.date));

      // The beach never shrinks: keep the highest chapter ever reached, and
      // a year stone for every anniversary reached (stored with the items).
      const derived = chapterFor(counts.memories, counts.completedActivities);
      const stored = (world?.chapter ?? 1) as ChapterNumber;
      const chapter = Math.max(derived, stored) as ChapterNumber;
      const anniv = anniversaryStatus(couple.relationship_start);
      const storedStones = yearStonesFrom(world?.unlocked_items);
      const stones = Math.max(anniv.reached, storedStones.length ? storedStones[storedStones.length - 1] : 0);
      if (!world || world.chapter !== chapter || storedStones.length < stones) {
        saveWorld(couple.id, chapter, [...unlockedItems(chapter), ...yearStoneItems(stones)]).catch((e) =>
          console.log("[Beach] saveWorld failed:", e.message),
        );
      }

      const imageUrl = latest?.imagePath
        ? await getSignedMediaUrl(latest.imagePath, 3600).catch(() => null)
        : null;

      setData({
        userId: user.id,
        coupleId: couple.id,
        firstName: name ? name.trim().split(/\s+/)[0] : null,
        relationshipStart: couple.relationship_start,
        inviteCode: partnerJoined ? null : couple.invite_code,
        partnerJoined,
        memoryCount: counts.memories,
        completedActivities: counts.completedActivities,
        latestMemory: latest ? { id: latest.id, title: latest.title, imageUrl, imagePath: latest.imagePath } : null,
        today,
        partnerId: partnerId ?? null,
        partnerFirstName: partnerFirst,
        welcomeNoteFromPartner: notes.find((n) => n.author_id !== user.id)?.note ?? null,
        todaySong: todaySongStatus(song, user.id, partnerJoined),
        chapter,
        dates,
        nextDate: upcoming[0],
        signCountdown: signCountdown(upcoming[0], daysOfUs(couple.relationship_start)),
        birthdayToday: bdayToday?.person_id
          ? {
              personId: bdayToday.person_id,
              name: (bdayToday.person_id === user.id ? myFirst : partnerFirst) ?? "you",
              age: ageOn(bdayToday.date),
            }
          : null,
        giftWaiting:
          waiting && waiting.birthdayWaiting > 0 && waiting.nextBirthdayUnlockAt
            ? { count: waiting.birthdayWaiting, nextUnlockAt: waiting.nextBirthdayUnlockAt }
            : null,
        bottlesInTransit: waiting?.bottlesInTransit ?? 0,
        washedBottleIds: washedAshore(received).map((b) => b.id),
        jar: { total: jarNotes.length, unopened: jarNotes.filter((n) => !n.opened_at).length },
        newMemoryFromPartner: recentPartner,
        rememberPool,
        unlockedGiftId: unopened[0]?.id ?? null,
        anniversary: anniv,
        yearStones: stones,
      });
      setError(null);
    } catch (err: any) {
      console.log("[Beach] load failed:", err.message);
      setError(err.message ?? String(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { data, error, reload: load };
}

// ---- Dates ---------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;

export function daysOfUs(relationshipStart: string) {
  return Math.max(0, Math.round((startOfToday().getTime() - parseLocalDate(relationshipStart).getTime()) / DAY));
}
