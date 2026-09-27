import { showBanner } from "@/lib/banners";
import { getMyCouple } from "@/lib/couples";
import { getProfiles } from "@/lib/profile";
import { onNotificationNavigate, onPushMessage, registerServiceWorker, syncPushSubscription, updatePresence } from "@/lib/push";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";

const NEUTRAL_SPICY = "Something's waiting for you 😏";

// Signed in + paired: register the service worker (web), keep this device's
// push subscription fresh, record timezone + last seen (throttled), follow
// notification taps, and show in-app banners — from pushes the service worker
// forwards, and (Realtime fallback, native too) from answers/reveals we can
// already see, in case a push is slow. Banners dedupe by the push tag.
export function usePushLifecycle(active: boolean) {
  useEffect(() => {
    if (!active) return;
    registerServiceWorker();
    syncPushSubscription();
    updatePresence(true);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        updatePresence();
        syncPushSubscription();
      }
    });
    const offNav = onNotificationNavigate((url) => router.push(url as any));
    const offPush = onPushMessage((p) => {
      const kind = (p.tag || "push").split(":")[0];
      showBanner({ key: p.tag || `${p.title}:${Date.now()}`, kind, title: p.title, body: p.body || undefined, url: p.url || "/" });
    });

    // ---- Realtime fallback ----
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const myId = auth.user?.id;
      const couple = myId ? await getMyCouple().catch(() => null) : null;
      if (!myId || !couple || cancelled) return;
      const partnerId = couple.partner_one === myId ? couple.partner_two : couple.partner_one;
      const name = partnerId ? ((await getProfiles([partnerId]).catch(() => ({}) as any))[partnerId]?.firstName ?? "Your person") : "Your person";
      if (cancelled) return;
      // RLS only delivers a partner's answer row once I've answered too — so
      // each of these is a real "it's revealed" moment.
      const partnerInsert = (payload: any) => payload?.new && payload.new.user_id && payload.new.user_id !== myId;
      channel = supabase
        .channel(`banners-${myId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_responses" }, (payload: any) => {
          if (!partnerInsert(payload)) return;
          showBanner({ key: `both_answered:${payload.new.daily_activity_id}`, kind: "both_answered", title: "Both answered — open it together ❤️", url: "/activity/today" });
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "question_answers" }, async (payload: any) => {
          if (!partnerInsert(payload)) return;
          const threadId = payload.new.thread_id as string;
          const { data } = await supabase.from("question_threads").select("question:questions(category)").eq("id", threadId).maybeSingle();
          const spicy = (data as any)?.question?.category === "spicy";
          showBanner({
            key: `question_answered:${threadId}:${payload.new.user_id}`,
            kind: "question_answered",
            title: spicy ? NEUTRAL_SPICY : `${name} answered — open it 👀`,
            url: `/play/question/${threadId}`,
          });
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "memory_reflections" }, (payload: any) => {
          if (!partnerInsert(payload)) return;
          showBanner({
            key: `reflection_written:${payload.new.memory_id}:${payload.new.user_id}`,
            kind: "reflection_written",
            title: `${name} wrote their side 👀`,
            url: `/memory/${payload.new.memory_id}`,
          });
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "anniversary_answers" }, (payload: any) => {
          if (!partnerInsert(payload)) return;
          showBanner({
            key: `anniversary_answer:${payload.new.anniversary_year}`,
            kind: "anniv_answer",
            title: `${name} answered — your next chapter is open 💌`,
            url: `/anniversary/${payload.new.anniversary_year}?page=answer`,
          });
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      sub.remove();
      offNav();
      offPush();
      if (channel) supabase.removeChannel(channel);
    };
  }, [active]);
}
