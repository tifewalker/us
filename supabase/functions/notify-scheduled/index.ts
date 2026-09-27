// notify-scheduled — pg_cron runs it every 10 minutes (021) via pg_net with
// the Vault secret. Everything is computed in each recipient's own timezone;
// notification_log makes every kind+ref send at most once. Timed
// notifications have a window (e.g. 08:30–11:30): during quiet hours they're
// held and retried on the next run while the window is open; nudges are
// dropped instead (they're only sent inside their window).
import { days, NUDGE_INACTIVE, NUDGE_MOMENT, NUDGE_SONG } from "../_shared/copy.ts";
import {
  adminClient,
  cors,
  daysBetween,
  flushQueue,
  getPeople,
  hasNotifySecret,
  hm,
  json,
  localDateOf,
  localNow,
  notify,
  pick,
  seededUnit,
  type Message,
  type Person,
} from "../_shared/notify.ts";

const within = (minutes: number, start: number, len: number) => minutes >= start && minutes < start + len;

// Next yearly occurrence of a 'YYYY-MM-DD' (month/day) on or after `today`
// (local), Feb 29 → Feb 28 in non-leap years. Returns days until + that year.
function nextYearly(dateStr: string, today: string) {
  const [, m, d] = dateStr.split("-").map(Number);
  const [ty] = today.split("-").map(Number);
  for (const y of [ty, ty + 1]) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const day = m === 2 && d === 29 && !leap ? 28 : d;
    const occ = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const n = daysBetween(today, occ);
    if (n >= 0) return { days: n, year: y };
  }
  return { days: 999, year: ty };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = adminClient();
  if (!(await hasNotifySecret(admin, req))) return json({ error: "forbidden" }, 403);

  const tally: Record<string, number> = {};
  const count = (k: string) => (tally[k] = (tally[k] ?? 0) + 1);
  const send = async (p: Person, m: Message) => {
    const o = await notify(admin, p, m, { whenQuiet: "hold" });
    count(`${m.kind}:${o}`);
  };

  try {
    count(`queue_flushed:${await flushQueue(admin)}`);

    const { data: couples } = await admin.from("couples").select("id, partner_one, partner_two, relationship_start").not("partner_two", "is", null);
    for (const c of couples ?? []) {
      const people = await getPeople(admin, [c.partner_one, c.partner_two]);
      const pair = [people[c.partner_one], people[c.partner_two]].filter(Boolean) as Person[];
      if (pair.length < 2) continue;

      const [{ data: bottles }, { data: dates }, { data: missions }] = await Promise.all([
        admin.from("bottles").select("id, sender_id, recipient_id, kind, unlock_at, opened_at").eq("couple_id", c.id).is("opened_at", null),
        admin.from("important_dates").select("id, type, date, label, person_id").eq("couple_id", c.id),
        admin
          .from("missions")
          .select("assignee_id, mission_date, reveal_at, completed_at")
          .eq("couple_id", c.id)
          .lte("reveal_at", new Date().toISOString())
          .gte("reveal_at", new Date(Date.now() - 36 * 3600_000).toISOString()),
      ]);

      for (const p of pair) {
        const L = localNow(p.tz);
        const now = Date.now();

        // ---- bottles & gifts ----
        for (const b of bottles ?? []) {
          if (b.recipient_id !== p.id) continue;
          if (b.kind === "bottle" && b.unlock_at && Date.parse(b.unlock_at) <= now) {
            await send(p, { kind: "bottle_arrived", refId: b.id, title: "Something washed ashore for you 🌊", url: `/bottle/${b.id}`, category: "bottles_gifts" });
          }
          if (b.kind === "birthday" && b.unlock_at) {
            const unlockDay = localDateOf(b.unlock_at, p.tz);
            const n = daysBetween(L.date, unlockDay);
            if ([7, 3, 1].includes(n) && within(L.minutes, hm(9), hm(12))) {
              await send(p, { kind: "gift_countdown", refId: `${b.id}:${n}`, title: `Something is waiting for you… ${days(n)} 🎁`, url: "/", category: "bottles_gifts" });
            }
            if (Date.parse(b.unlock_at) <= now && unlockDay === L.date && within(L.minutes, hm(8), hm(4))) {
              await send(p, { kind: "gift_ready", refId: b.id, title: "Your gift is ready 🎁", url: `/gift/${b.id}`, category: "bottles_gifts" });
            }
          }
        }

        // ---- dates ----
        for (const d of dates ?? []) {
          const { days: n, year } = nextYearly(d.date, L.date);
          if (d.type === "birthday" && d.person_id) {
            const birthdayPerson = pair.find((q) => q.id === d.person_id);
            if (!birthdayPerson) continue;
            if (p.id !== d.person_id && (n === 7 || n === 1) && within(L.minutes, hm(9), hm(12))) {
              const hasGift = (bottles ?? []).some((b) => b.kind === "birthday" && b.sender_id === p.id && b.recipient_id === d.person_id);
              const when = n === 7 ? "in 7 days" : "tomorrow";
              await send(p, {
                kind: "birthday_soon",
                refId: `${d.id}:${year}:${n}`,
                title: hasGift ? `${birthdayPerson.name}'s birthday is ${when} 🎂` : `${birthdayPerson.name}'s birthday is ${when} — prepare a surprise?`,
                url: hasGift ? "/us" : "/gift/prepare",
                category: "dates",
              });
            }
            if (n === 0 && within(L.minutes, hm(8, 30), hm(3))) {
              await send(p, {
                kind: "birthday_today",
                refId: `${d.id}:${year}`,
                title: p.id === d.person_id ? `Happy birthday, ${p.name} 🎂` : `It's ${birthdayPerson.name}'s birthday today 🎂`,
                url: "/",
                category: "dates",
              });
            }
          } else if (d.type === "custom" && n === 0 && within(L.minutes, hm(8, 30), hm(3))) {
            await send(p, { kind: "date_today", refId: `${d.id}:${year}`, title: `Today: ${d.label}`, url: "/us", category: "dates" });
          }
        }
        if (c.relationship_start) {
          const { days: n, year } = nextYearly(c.relationship_start, L.date);
          const startYear = Number(c.relationship_start.slice(0, 4));
          if (year > startYear) {
            if (n === 3 && within(L.minutes, hm(9), hm(12))) {
              await send(p, { kind: "anniv_soon", refId: String(year), title: "3 days until our anniversary", url: "/us", category: "dates" });
            }
            if (n === 0 && within(L.minutes, hm(8, 30), hm(3))) {
              await send(p, { kind: "anniv_today", refId: String(year), title: "Happy anniversary 🌅 — another year of us", url: "/", category: "dates" });
            }
            // 19:30: the recap, for whoever hasn't opened it yet (anniversary_views, 022)
            if (n === 0 && within(L.minutes, hm(19, 30), hm(3))) {
              const annivN = year - startYear;
              const { count: viewed } = await admin
                .from("anniversary_views")
                .select("user_id", { count: "exact", head: true })
                .eq("user_id", p.id)
                .eq("couple_id", c.id)
                .eq("anniversary_year", annivN);
              if (!viewed) {
                await send(p, { kind: "recap_ready", refId: String(annivN), title: "Your year together is ready to watch 🌅", url: `/anniversary/${annivN}`, category: "dates" });
              }
            }
          }
        }

        // ---- missions revealed at reveal_at (if the second completion didn't already) ----
        const dayOfMine = (missions ?? []).filter((m) => m.assignee_id === p.id);
        for (const m of dayOfMine) {
          await send(p, { kind: "missions_revealed", refId: `${c.id}:${m.mission_date}`, title: "Your missions are revealed 🤫", url: "/play/missions", category: "partner_activity" });
        }

        // ---- Remember when… at 21:00 on remember days ----
        if (within(L.minutes, hm(21), hm(1, 30))) {
          const { data: row } = await admin.from("remember_days").select("day").eq("couple_id", c.id).eq("day", L.date).maybeSingle();
          const isDay = !!row || seededUnit(`${c.id}:${L.date}`, 7) < 0.4; // same rule as lib/remember.ts
          if (isDay) {
            const cutoff = new Date(now - 30 * 86_400_000).toISOString();
            const { count: old } = await admin.from("memories").select("id", { count: "exact", head: true }).eq("couple_id", c.id).lte("created_at", cutoff);
            if (row || (old ?? 0) > 0) {
              await send(p, { kind: "remember", refId: `${c.id}:${L.date}`, title: "Remember when… 🌙", url: "/", category: "remember" });
            }
          }
        }

        // ---- nudges (dropped in quiet hours; capped per day) ----
        if (within(L.minutes, hm(17, 30), hm(1))) {
          const { data: day } = await admin.from("daily_activities").select("id").eq("couple_id", c.id).eq("activity_date", L.date).maybeSingle();
          let answered = false;
          if (day) {
            const { count: mine } = await admin.from("activity_responses").select("id", { count: "exact", head: true }).eq("daily_activity_id", day.id).eq("user_id", p.id);
            answered = (mine ?? 0) > 0;
          }
          if (!answered) {
            await send(p, { kind: "nudge_moment", refId: L.date, title: pick(NUDGE_MOMENT, `${p.id}:${L.date}`), url: "/activity/today", category: "nudges" });
          }
        }
        if (within(L.minutes, hm(12), hm(1))) {
          const { count: picked } = await admin.from("daily_songs").select("id", { count: "exact", head: true }).eq("couple_id", c.id).eq("song_date", L.date);
          if ((picked ?? 0) === 0) {
            const { count: recent } = await admin
              .from("notification_log")
              .select("id", { count: "exact", head: true })
              .eq("user_id", p.id)
              .eq("kind", "nudge_song")
              .gte("sent_at", new Date(now - 36 * 3600_000).toISOString()); // at most every other day
            if ((recent ?? 0) === 0) {
              await send(p, { kind: "nudge_song", refId: L.date, title: pick(NUDGE_SONG, `${p.id}:${L.date}`), url: "/music/today", category: "nudges" });
            }
          }
        }
        if (within(L.minutes, hm(19), hm(1)) && p.lastSeen && now - Date.parse(p.lastSeen) > 3 * 86_400_000) {
          const { count: recent } = await admin
            .from("notification_log")
            .select("id", { count: "exact", head: true })
            .eq("user_id", p.id)
            .eq("kind", "nudge_inactive")
            .gte("sent_at", new Date(now - 4 * 86_400_000 + 3600_000).toISOString());
          if ((recent ?? 0) === 0) {
            await send(p, { kind: "nudge_inactive", refId: L.date, title: pick(NUDGE_INACTIVE, `${p.id}:${L.date}`), url: "/", category: "nudges" });
          }
        }
      }
    }
    return json({ ok: true, tally });
  } catch (e) {
    console.error("[notify-scheduled]", e);
    return json({ error: String(e), tally }, 500);
  }
});
