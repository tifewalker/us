// notify-event — called by database triggers (021) through pg_net with the
// Vault secret in x-notify-secret (verify_jwt is off; the secret is the auth).
// The trigger sends only ids; everything else is read here with the service
// role. Copy never includes answer text / bottle text; spicy → neutral.
import { adminClient, cors, getPeople, hasNotifySecret, json, NEUTRAL_SPICY, notify, partnerOf, type Message } from "../_shared/notify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = adminClient();
  if (!(await hasNotifySecret(admin, req))) return json({ error: "forbidden" }, 403);
  const ev = await req.json().catch(() => ({}));

  try {
    const results: string[] = [];
    // send `msg` (with {Name} = the actor) to the actor's partner
    const toPartner = async (coupleId: string, actorId: string, make: (actorName: string) => Omit<Message, "category"> & { category?: Message["category"] }) => {
      const partnerId = await partnerOf(admin, coupleId, actorId);
      if (!partnerId) return;
      const people = await getPeople(admin, [actorId, partnerId]);
      const partner = people[partnerId];
      if (!partner) return;
      const m = make(people[actorId]?.name ?? "Your person");
      results.push(await notify(admin, partner, { category: "partner_activity", ...m }));
    };

    switch (ev.table) {
      case "activity_responses": {
        const { data: r } = await admin.from("activity_responses").select("user_id, daily_activity_id").eq("id", ev.id).maybeSingle();
        if (!r) break;
        const { data: day } = await admin.from("daily_activities").select("couple_id").eq("id", r.daily_activity_id).maybeSingle();
        if (!day) break;
        const partnerId = await partnerOf(admin, day.couple_id, r.user_id);
        const { count } = await admin
          .from("activity_responses")
          .select("id", { count: "exact", head: true })
          .eq("daily_activity_id", r.daily_activity_id)
          .eq("user_id", partnerId ?? "");
        const both = (count ?? 0) > 0;
        await toPartner(day.couple_id, r.user_id, (name) =>
          both
            ? { kind: "both_answered", refId: r.daily_activity_id, title: "Both answered — open it together ❤️", url: "/activity/today" }
            : { kind: "activity_answered", refId: r.daily_activity_id, title: `${name} answered today's moment — your turn 👀`, url: "/activity/today" },
        );
        break;
      }
      case "question_threads": {
        const { data: t } = await admin.from("question_threads").select("id, couple_id, asked_by, question:questions(category)").eq("id", ev.id).maybeSingle();
        if (!t) break;
        const spicy = (t as any).question?.category === "spicy";
        await toPartner(t.couple_id, t.asked_by, (name) => ({
          kind: "question_asked",
          refId: t.id,
          title: spicy ? NEUTRAL_SPICY : `${name} asked you something`,
          url: `/play/question/${t.id}`,
        }));
        break;
      }
      case "question_answers": {
        const { data: t } = await admin.from("question_threads").select("id, couple_id, question:questions(category)").eq("id", ev.thread_id).maybeSingle();
        if (!t) break;
        const spicy = (t as any).question?.category === "spicy";
        await toPartner(t.couple_id, ev.user_id, (name) => ({
          kind: "question_answered",
          refId: `${t.id}:${ev.user_id}`,
          title: spicy ? NEUTRAL_SPICY : `${name} answered — open it 👀`,
          url: `/play/question/${t.id}`,
        }));
        break;
      }
      case "daily_songs": {
        const { data: s } = await admin.from("daily_songs").select("id, couple_id, picked_by").eq("id", ev.id).maybeSingle();
        if (!s) break;
        await toPartner(s.couple_id, s.picked_by, (name) => ({ kind: "song_picked", refId: s.id, title: `${name} picked a song for you 🎧`, url: "/music/today" }));
        break;
      }
      case "memories": {
        const { data: m } = await admin.from("memories").select("id, couple_id, created_by, title").eq("id", ev.id).maybeSingle();
        if (!m) break;
        const title = (m.title ?? "").length > 40 ? `${m.title.slice(0, 39)}…` : m.title;
        await toPartner(m.couple_id, m.created_by, (name) => ({
          kind: "memory_added",
          refId: m.id,
          title: `${name} added '${title}' — what do you remember?`,
          url: `/memory/${m.id}`,
        }));
        break;
      }
      case "memory_reflections": {
        const { data: r } = await admin.from("memory_reflections").select("user_id, memory_id").eq("id", ev.id).maybeSingle();
        if (!r) break;
        const { data: m } = await admin.from("memories").select("couple_id").eq("id", r.memory_id).maybeSingle();
        if (!m) break;
        await toPartner(m.couple_id, r.user_id, (name) => ({ kind: "reflection_written", refId: `${r.memory_id}:${r.user_id}`, title: `${name} wrote their side 👀`, url: `/memory/${r.memory_id}` }));
        break;
      }
      case "missions": {
        const { data: mi } = await admin.from("missions").select("couple_id, mission_date").eq("id", ev.id).maybeSingle();
        if (!mi) break;
        const { data: day } = await admin.from("missions").select("assignee_id, completed_at").eq("couple_id", mi.couple_id).eq("mission_date", mi.mission_date);
        if (!day || day.length < 2 || day.some((d) => !d.completed_at)) break; // only when the second one is done
        const people = await getPeople(admin, day.map((d) => d.assignee_id));
        for (const p of Object.values(people)) {
          results.push(await notify(admin, p, { kind: "missions_revealed", refId: `${mi.couple_id}:${mi.mission_date}`, title: "Your missions are revealed 🤫", url: "/play/missions", category: "partner_activity" }));
        }
        break;
      }
      case "bottles": {
        const { data: b } = await admin.from("bottles").select("id, recipient_id, kind, unlock_at").eq("id", ev.id).maybeSingle();
        if (!b) break;
        const people = await getPeople(admin, [b.recipient_id]);
        const p = people[b.recipient_id];
        if (!p) break;
        if (b.kind === "open_when") {
          results.push(await notify(admin, p, { kind: "open_when_sent", refId: b.id, title: "A new 'Open when…' letter is in your jar 🫙", url: "/bottle/jar", category: "bottles_gifts" }));
        } else if (b.kind === "bottle" && b.unlock_at && Date.parse(b.unlock_at) <= Date.now() + 5_000) {
          // sent "Now": it has already washed ashore — tell them right away
          // (same kind + ref as notify-scheduled, so it's never sent twice)
          results.push(await notify(admin, p, { kind: "bottle_arrived", refId: b.id, title: "Something washed ashore for you 🌊", url: `/bottle/${b.id}`, category: "bottles_gifts" }));
        }
        break;
      }
      default:
        return json({ error: "unknown event" }, 400);
    }
    return json({ ok: true, results });
  } catch (e) {
    console.error("[notify-event]", ev?.table, e);
    return json({ error: String(e) }, 500);
  }
});
