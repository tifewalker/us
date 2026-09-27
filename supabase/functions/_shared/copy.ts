// Notification copy. Warm, short, no guilt, never private content (no
// answers, no bottle/gift text). Nudges rotate between variants, seeded by
// person + date so a given day's wording is stable.

export const NUDGE_MOMENT = [
  "Today's moment is waiting on the beach 🌅",
  "A little question is waiting for you 🐚",
  "Got a minute for today's moment? 💌",
];

export const NUDGE_SONG = [
  "No song for today yet — want to pick one? 🎧",
  "The beach radio is quiet today 📻",
  "What song feels like today? 🎶",
];

export const NUDGE_INACTIVE = [
  "Your beach misses you 🌊",
  "The tide's been rolling in without you 🌊",
  "The sand's still warm — come say hi 🏖️",
];

export const days = (n: number) => (n === 1 ? "1 day" : `${n} days`);

// What the dev panel can fire at yourself (notify-send { kind }). Same copy
// as the real ones, with "Alex" standing in for your partner's name.
export function sampleFor(kind: string, partner: string): { title: string; url: string } | null {
  const samples: Record<string, { title: string; url: string }> = {
    test: { title: "It works — notifications from Us are on 🌊", url: "/settings" },
    activity_answered: { title: `${partner} answered today's moment — your turn 👀`, url: "/activity/today" },
    both_answered: { title: "Both answered — open it together ❤️", url: "/activity/today" },
    question_asked: { title: `${partner} asked you something`, url: "/play/questions" },
    question_answered: { title: `${partner} answered — open it 👀`, url: "/play/questions" },
    spicy: { title: "Something's waiting for you 😏", url: "/play/questions" },
    song_picked: { title: `${partner} picked a song for you 🎧`, url: "/music/today" },
    memory_added: { title: `${partner} added 'Sunset at the pier' — what do you remember?`, url: "/story" },
    reflection_written: { title: `${partner} wrote their side 👀`, url: "/story" },
    missions_revealed: { title: "Your missions are revealed 🤫", url: "/play/missions" },
    bottle_arrived: { title: "Something washed ashore for you 🌊", url: "/" },
    open_when_sent: { title: "A new 'Open when…' letter is in your jar 🫙", url: "/bottle/jar" },
    gift_countdown: { title: "Something is waiting for you… 3 days 🎁", url: "/" },
    gift_ready: { title: "Your gift is ready 🎁", url: "/" },
    birthday_soon: { title: `${partner}'s birthday is in 7 days — prepare a surprise?`, url: "/gift/prepare" },
    birthday_today: { title: `Happy birthday, ${partner} 🎂`, url: "/" },
    anniv_soon: { title: "3 days until our anniversary", url: "/us" },
    anniv_today: { title: "Happy anniversary 🌅 — another year of us", url: "/" },
    recap_ready: { title: "Your year together is ready to watch 🌅", url: "/anniversary/preview" },
    date_today: { title: "Today: Our first trip", url: "/us" },
    remember: { title: "Remember when… 🌙", url: "/" },
    nudge_moment: { title: NUDGE_MOMENT[0], url: "/activity/today" },
    nudge_song: { title: NUDGE_SONG[0], url: "/music/today" },
    nudge_inactive: { title: NUDGE_INACTIVE[0], url: "/" },
  };
  return samples[kind] ?? null;
}
