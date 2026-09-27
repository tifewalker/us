import { useSyncExternalStore } from "react";
import { getCurrentUser } from "./auth";
import { getMyCouple } from "./couples";
import { getReceivedBottles } from "./bottles";
import { getUnopenedGiftsForMe } from "./gifts";
import { getPlaySummary } from "./play";
import { setAppBadge } from "./push";
import { getTodayStatus } from "./world";

// The small coral dot on the Play tab icon: something is waiting for me —
// an unanswered question my partner asked, today's activity not answered by
// me yet, or a revealed partner mission I haven't looked at.
// Also sets the home-screen icon badge (web app) to the number of waiting
// things: those + bottles that washed ashore unopened + unlocked gifts
// (RLS only returns arrived/unlocked ones to me). Cleared at zero.

let waiting = false;
const listeners = new Set<() => void>();

export async function refreshPlayBadge() {
  try {
    const user = await getCurrentUser();
    const couple = await getMyCouple();
    if (!couple?.partner_two) return set(false);
    const [summary, today, bottles, gifts] = await Promise.all([
      getPlaySummary(couple.id, user.id),
      getTodayStatus(couple.id, user.id, true).catch(() => null),
      getReceivedBottles(couple.id, user.id).catch(() => []),
      getUnopenedGiftsForMe(couple.id, user.id).catch(() => []),
    ]);
    const momentWaiting = today === "fresh" || today === "yourTurn";
    set(summary.questionsWaitingForMe > 0 || summary.unseenMissionReveal || momentWaiting);
    setAppBadge(
      summary.questionsWaitingForMe +
        (summary.unseenMissionReveal ? 1 : 0) +
        (momentWaiting ? 1 : 0) +
        bottles.filter((b) => b.kind === "bottle" && !b.opened_at).length +
        gifts.length,
    );
  } catch {
    // signed out / offline — leave the dot as it was
  }
}

function set(v: boolean) {
  if (v === waiting) return;
  waiting = v;
  listeners.forEach((l) => l());
}

export function usePlayBadge() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => waiting,
  );
}
