-- 017: the Play tab — couple questions, secret missions, roulette, spicy mode
-- (both-partner opt-in), custom cards, and the activity-photo storage lock.
begin;

-- =====================================================================
-- 0. Spicy mode: on only when BOTH partners have opted in
-- =====================================================================
create table public.spicy_consents (
  couple_id  uuid not null references public.couples(id) on delete cascade,
  user_id    uuid not null references public.users(id),
  enabled_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);
alter table public.spicy_consents enable row level security;
create policy "members read spicy consents" on public.spicy_consents
  for select to authenticated using (public.is_couple_member(couple_id));
create policy "opt in myself" on public.spicy_consents
  for insert to authenticated with check (user_id = auth.uid() and public.is_couple_member(couple_id));
create policy "opt out myself" on public.spicy_consents
  for delete to authenticated using (user_id = auth.uid());
revoke all on public.spicy_consents from anon;

-- Is spicy on for this couple (both rows present)? Caller must be a member.
create or replace function public.spicy_enabled_for(target_couple_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_couple_member(target_couple_id)
     and (select count(distinct user_id) from public.spicy_consents where couple_id = target_couple_id) >= 2;
$$;
-- Is spicy on for MY couple? (used by the content tables' read policies)
create or replace function public.my_spicy_enabled()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.couples c
    where (c.partner_one = auth.uid() or c.partner_two = auth.uid())
      and (select count(distinct s.user_id) from public.spicy_consents s where s.couple_id = c.id) >= 2);
$$;
revoke execute on function public.spicy_enabled_for(uuid), public.my_spicy_enabled() from public, anon;
grant execute on function public.spicy_enabled_for(uuid), public.my_spicy_enabled() to authenticated;

-- =====================================================================
-- 1. Content cards (global seeds have couple_id null; couple-made cards
--    belong to one couple). Spicy cards are invisible unless both opted in.
-- =====================================================================
create table public.questions (
  id         uuid primary key default gen_random_uuid(),
  category   text not null check (category in ('know_you','deep','future','would_you_rather','fun','spicy')),
  text       text not null check (char_length(text) between 1 and 300),
  couple_id  uuid references public.couples(id) on delete cascade,
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  check ((couple_id is null) = (created_by is null))
);
create table public.mission_templates (
  id         uuid primary key default gen_random_uuid(),
  category   text not null check (category in ('romantic','funny','deep','chaotic','flirty','adventure','long_distance','spicy')),
  text       text not null check (char_length(text) between 1 and 300),
  duration   text not null default 'today' check (duration in ('quick','today','weekend')),
  couple_id  uuid references public.couples(id) on delete cascade,
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  check ((couple_id is null) = (created_by is null))
);
create table public.roulette_challenges (
  id         uuid primary key default gen_random_uuid(),
  mood       text not null check (mood in ('easy','romantic','funny','chaotic','hard','spicy')),
  text       text not null check (char_length(text) between 1 and 300),
  couple_id  uuid references public.couples(id) on delete cascade,
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  check ((couple_id is null) = (created_by is null))
);

alter table public.questions           enable row level security;
alter table public.mission_templates   enable row level security;
alter table public.roulette_challenges enable row level security;

create policy "read cards" on public.questions for select to authenticated
  using ((couple_id is null or public.is_couple_member(couple_id))
         and (category <> 'spicy' or public.my_spicy_enabled()));
create policy "add our card" on public.questions for insert to authenticated
  with check (couple_id is not null and created_by = auth.uid() and public.is_couple_member(couple_id)
              and (category <> 'spicy' or public.spicy_enabled_for(couple_id)));
create policy "remove our card" on public.questions for delete to authenticated
  using (couple_id is not null and created_by = auth.uid());

create policy "read cards" on public.mission_templates for select to authenticated
  using ((couple_id is null or public.is_couple_member(couple_id))
         and (category <> 'spicy' or public.my_spicy_enabled()));
create policy "add our card" on public.mission_templates for insert to authenticated
  with check (couple_id is not null and created_by = auth.uid() and public.is_couple_member(couple_id)
              and (category <> 'spicy' or public.spicy_enabled_for(couple_id)));
create policy "remove our card" on public.mission_templates for delete to authenticated
  using (couple_id is not null and created_by = auth.uid());

create policy "read cards" on public.roulette_challenges for select to authenticated
  using ((couple_id is null or public.is_couple_member(couple_id))
         and (mood <> 'spicy' or public.my_spicy_enabled()));
create policy "add our card" on public.roulette_challenges for insert to authenticated
  with check (couple_id is not null and created_by = auth.uid() and public.is_couple_member(couple_id)
              and (mood <> 'spicy' or public.spicy_enabled_for(couple_id)));
create policy "remove our card" on public.roulette_challenges for delete to authenticated
  using (couple_id is not null and created_by = auth.uid());

revoke all on public.questions, public.mission_templates, public.roulette_challenges from anon;

-- =====================================================================
-- 2. Couple questions: threads + answers with a DB-enforced reveal (like 009)
-- =====================================================================
create table public.question_threads (
  id          uuid primary key default gen_random_uuid(),
  couple_id   uuid not null references public.couples(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  asked_by    uuid not null references public.users(id),
  created_at  timestamptz default now(),
  unique (couple_id, question_id)
);
create table public.question_answers (
  thread_id  uuid not null references public.question_threads(id) on delete cascade,
  user_id    uuid not null references public.users(id),
  answer     text not null check (char_length(answer) between 1 and 1000),
  created_at timestamptz default now(),
  primary key (thread_id, user_id)
);
alter table public.question_threads enable row level security;
alter table public.question_answers enable row level security;

create policy "members read threads" on public.question_threads for select to authenticated
  using (public.is_couple_member(couple_id));
-- the question must be readable to the asker (so spicy needs consent) and global or ours
create policy "ask a question" on public.question_threads for insert to authenticated
  with check (asked_by = auth.uid() and public.is_couple_member(couple_id)
              and exists (select 1 from public.questions q
                          where q.id = question_threads.question_id
                            and (q.couple_id is null or q.couple_id = question_threads.couple_id)));

create or replace function public.has_answered_question(target_thread_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.question_answers
                 where thread_id = target_thread_id and user_id = auth.uid());
$$;
create or replace function public.partner_has_answered_question(target_thread_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.question_answers a
    join public.question_threads t on t.id = a.thread_id
    where a.thread_id = target_thread_id and a.user_id <> auth.uid() and public.is_couple_member(t.couple_id));
$$;
revoke execute on function public.has_answered_question(uuid), public.partner_has_answered_question(uuid) from public, anon;
grant execute on function public.has_answered_question(uuid), public.partner_has_answered_question(uuid) to authenticated;

create policy "read own or revealed answers" on public.question_answers for select to authenticated
  using (user_id = auth.uid()
         or (public.has_answered_question(thread_id) and exists (
               select 1 from public.question_threads t
               where t.id = question_answers.thread_id and public.is_couple_member(t.couple_id))));
create policy "answer myself" on public.question_answers for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.question_threads t
    where t.id = question_answers.thread_id and public.is_couple_member(t.couple_id)));
create policy "edit my answer" on public.question_answers for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete my answer" on public.question_answers for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.question_threads, public.question_answers from anon;
alter publication supabase_realtime add table public.question_answers;

-- =====================================================================
-- 3. Secret missions (replaces the unused, client-locked missions table)
-- =====================================================================
drop table public.missions;
create table public.missions (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references public.couples(id) on delete cascade,
  assignee_id  uuid not null references public.users(id),
  template_id  uuid references public.mission_templates(id) on delete set null,
  mission_text text not null,
  category     text not null,
  mission_date date not null,
  reveal_at    timestamptz not null,  -- local midnight at the end of the mission day (client sets it)
  completed_at timestamptz,
  what_i_did   text check (what_i_did is null or char_length(what_i_did) <= 500),
  noticed      text check (noticed is null or noticed in ('noticed','no_idea')),  -- set by the OTHER partner
  created_at   timestamptz default now(),
  unique (couple_id, assignee_id, mission_date)
);
alter table public.missions enable row level security;

-- Revealed = both partners completed that day's missions, or reveal_at passed.
create or replace function public.mission_is_revealed(target_mission_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.missions m
    where m.id = target_mission_id and public.is_couple_member(m.couple_id)
      and (now() >= m.reveal_at
           or (select count(distinct x.assignee_id) from public.missions x
               where x.couple_id = m.couple_id and x.mission_date = m.mission_date
                 and x.completed_at is not null) >= 2));
$$;
-- "{Name} is on a secret mission 🤫" — without any content.
create or replace function public.partner_has_mission_today(target_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.missions m
    where m.mission_date = target_date and m.assignee_id <> auth.uid() and public.is_couple_member(m.couple_id));
$$;
revoke execute on function public.mission_is_revealed(uuid), public.partner_has_mission_today(date) from public, anon;
grant execute on function public.mission_is_revealed(uuid), public.partner_has_mission_today(date) to authenticated;

create policy "read my mission or a revealed one" on public.missions for select to authenticated
  using (assignee_id = auth.uid() or (public.is_couple_member(couple_id) and public.mission_is_revealed(id)));
create policy "draw my mission" on public.missions for insert to authenticated
  with check (assignee_id = auth.uid() and public.is_couple_member(couple_id));
create policy "update mine, or say if I noticed theirs" on public.missions for update to authenticated
  using (assignee_id = auth.uid() or (public.is_couple_member(couple_id) and public.mission_is_revealed(id)))
  with check (public.is_couple_member(couple_id));
create policy "drop my unfinished mission" on public.missions for delete to authenticated
  using (assignee_id = auth.uid() and completed_at is null);
revoke all on public.missions from anon;

-- The assignee may change anything but `noticed`; the partner may change ONLY `noticed`.
create or replace function public.missions_update_rules()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() = old.assignee_id then
    if new.noticed is distinct from old.noticed then
      raise exception 'only your partner can say whether they noticed';
    end if;
  elsif (to_jsonb(new) - 'noticed') is distinct from (to_jsonb(old) - 'noticed') then
    raise exception 'partners can only say whether they noticed';
  end if;
  return new;
end; $$;
revoke execute on function public.missions_update_rules() from public, anon, authenticated;
create trigger missions_update_rules before update on public.missions
  for each row execute function public.missions_update_rules();

-- =====================================================================
-- 4. Roulette spins
-- =====================================================================
create table public.roulette_spins (
  id             uuid primary key default gen_random_uuid(),
  couple_id      uuid not null references public.couples(id) on delete cascade,
  spun_by        uuid not null references public.users(id),
  challenge_id   uuid references public.roulette_challenges(id) on delete set null,
  challenge_text text not null,  -- snapshot, so a deleted custom card's spin still reads
  mood           text not null,
  created_at     timestamptz default now(),
  done_at        timestamptz
);
alter table public.roulette_spins enable row level security;
create policy "members read spins" on public.roulette_spins for select to authenticated
  using (public.is_couple_member(couple_id));
create policy "spin" on public.roulette_spins for insert to authenticated
  with check (spun_by = auth.uid() and public.is_couple_member(couple_id));
create policy "mark done" on public.roulette_spins for update to authenticated
  using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
revoke all on public.roulette_spins from anon;
revoke update on public.roulette_spins from authenticated;
grant update (done_at) on public.roulette_spins to authenticated;  -- members can only set done_at

-- =====================================================================
-- 5. Activity-photo lock: <couple>/activity-responses/<daily_activity_id>/<user_id>/<file>
--    readable by the uploader, or the partner only once they've answered too.
-- =====================================================================
create or replace function public.try_uuid(t text)
returns uuid language sql immutable set search_path = public as $$
  select case when t ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t::uuid end;
$$;
create or replace function public.can_read_activity_photo(target_daily_activity_id uuid, uploader_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_daily_activity_id is not null and uploader_id is not null
     and (uploader_id = auth.uid()
          or exists (select 1 from public.daily_activities da
                     where da.id = target_daily_activity_id and public.is_couple_member(da.couple_id)
                       and public.has_answered(target_daily_activity_id)));
$$;
revoke execute on function public.can_read_activity_photo(uuid, uuid) from public, anon;
grant execute on function public.can_read_activity_photo(uuid, uuid) to authenticated;

drop policy "couple members can read their media" on storage.objects;
create policy "couple members can read their media" on storage.objects
  for select using (
    bucket_id = 'memory-media'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
    and ((storage.foldername(name))[2] is distinct from 'sealed'
         or public.can_read_sealed(((storage.foldername(name))[3])::uuid))
    and ((storage.foldername(name))[2] is distinct from 'activity-responses'
         or public.can_read_activity_photo(public.try_uuid((storage.foldername(name))[3]),
                                           public.try_uuid((storage.foldername(name))[4]))));
drop policy "couple members can upload their media" on storage.objects;
create policy "couple members can upload their media" on storage.objects
  for insert with check (
    bucket_id = 'memory-media'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
    and ((storage.foldername(name))[2] is distinct from 'sealed'
         or public.can_write_sealed(((storage.foldername(name))[3])::uuid))
    and ((storage.foldername(name))[2] is distinct from 'activity-responses'
         or (storage.foldername(name))[4] = auth.uid()::text));
drop policy "couple members can update their media" on storage.objects;
create policy "couple members can update their media" on storage.objects
  for update using (
    bucket_id = 'memory-media'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
    and ((storage.foldername(name))[2] is distinct from 'sealed'
         or public.can_write_sealed(((storage.foldername(name))[3])::uuid))
    and ((storage.foldername(name))[2] is distinct from 'activity-responses'
         or (storage.foldername(name))[4] = auth.uid()::text));
drop policy "couple members can delete their media" on storage.objects;
create policy "couple members can delete their media" on storage.objects
  for delete using (
    bucket_id = 'memory-media'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
    and ((storage.foldername(name))[2] is distinct from 'sealed'
         or public.can_write_sealed(((storage.foldername(name))[3])::uuid))
    and ((storage.foldername(name))[2] is distinct from 'activity-responses'
         or (storage.foldername(name))[4] = auth.uid()::text));

-- =====================================================================
-- 6. Seed content
-- =====================================================================
insert into public.questions (category, text) values
-- know_you (12)
('know_you', 'What’s a small thing I do that instantly makes your day better?'),
('know_you', 'What song would you put on if you wanted to feel like yourself again?'),
('know_you', 'What’s your comfort meal when everything feels like too much?'),
('know_you', 'Which memory from your childhood do you replay the most?'),
('know_you', 'What’s something you’re quietly proud of that you rarely mention?'),
('know_you', 'What does your perfect lazy Sunday look like, hour by hour?'),
('know_you', 'Who was your first celebrity crush — and be honest?'),
('know_you', 'What’s a smell that takes you straight back to a specific moment?'),
('know_you', 'What’s the kindest thing a stranger has ever done for you?'),
('know_you', 'What’s a word or phrase you secretly overuse?'),
('know_you', 'If you had a whole free day with no one needing you, what would you do first?'),
('know_you', 'What’s one thing about you that most people get wrong?'),
-- deep (12)
('deep', 'When do you feel most loved by me?'),
('deep', 'What’s something you’re still healing from?'),
('deep', 'What’s a fear you’ve never said out loud?'),
('deep', 'When was the last time you felt truly at peace?'),
('deep', 'What do you wish people understood about you without you having to explain?'),
('deep', 'What’s a belief you held strongly that you’ve changed your mind about?'),
('deep', 'What part of our relationship do you feel most grateful for right now?'),
('deep', 'What’s something you need more of from me, even if it’s small?'),
('deep', 'When you’re struggling, what’s the most helpful thing I can do?'),
('deep', 'What does home mean to you — a place, a person, or a feeling?'),
('deep', 'What’s a moment you felt really seen by me?'),
('deep', 'What’s one thing you want to forgive yourself for?'),
-- future (12)
('future', 'Where do you picture us waking up five years from now?'),
('future', 'What’s one trip we have to take together before we’re 30?'),
('future', 'What tradition do you want us to start this year?'),
('future', 'What would our dream Saturday look like when we finally live in the same place?'),
('future', 'What’s a skill you want us to learn together?'),
('future', 'What kind of home do you see us building — cosy, loud, calm, full of plants?'),
('future', 'What do you want to be doing for work in ten years if nothing held you back?'),
('future', 'What’s something you want to be really good at when we’re old?'),
('future', 'Which of our friends do you think will still be around in 20 years?'),
('future', 'What would you want our anniversary to look like ten years from now?'),
('future', 'What’s a big dream you haven’t told me about yet?'),
('future', 'If we could live anywhere for a year, where would you pick?'),
-- would_you_rather (12)
('would_you_rather', 'Would you rather have a picnic on a beach at sunrise or a rooftop at sunset?'),
('would_you_rather', 'Would you rather relive our first date or skip ahead to a random day ten years from now?'),
('would_you_rather', 'Would you rather always know what I’m thinking or always know what I’m feeling?'),
('would_you_rather', 'Would you rather have a week in a cabin with no signal or a week in a city we’ve never seen?'),
('would_you_rather', 'Would you rather only text in voice notes or only in emojis for a week?'),
('would_you_rather', 'Would you rather cook together every night or be cooked for every night?'),
('would_you_rather', 'Would you rather have a matching tattoo or matching pyjamas forever?'),
('would_you_rather', 'Would you rather lose your phone for a week or give up your favourite food for a month?'),
('would_you_rather', 'Would you rather slow dance in the kitchen or sing badly in the car?'),
('would_you_rather', 'Would you rather receive one long love letter or a small note every day for a month?'),
('would_you_rather', 'Would you rather go back and meet me earlier or keep the timing exactly as it was?'),
('would_you_rather', 'Would you rather have a surprise date planned for you or plan one for me?'),
-- fun (12)
('fun', 'If we were a duo in a heist movie, what would each of our roles be?'),
('fun', 'What’s the most chaotic thing we’ve done together so far?'),
('fun', 'Which animal do you think I’d be, and why?'),
('fun', 'What would our couple name be if we were famous?'),
('fun', 'If our relationship had a theme song, what would it be?'),
('fun', 'What’s a food combination you love that I’d probably judge?'),
('fun', 'What would you name our imaginary dog?'),
('fun', 'What’s the funniest misunderstanding we’ve ever had?'),
('fun', 'If you could swap lives with me for a day, what’s the first thing you’d do?'),
('fun', 'What’s my most dramatic habit?'),
('fun', 'Which emoji is most “us”?'),
('fun', 'What’s a hill you’d die on that makes no sense to anyone else?'),
-- spicy (20)
('spicy', 'What’s the first moment you remember being really attracted to me?'),
('spicy', 'What’s something I do without realising that you find irresistible?'),
('spicy', 'Where’s the most memorable place we’ve kissed?'),
('spicy', 'What outfit of mine do you think about more than you’d admit?'),
('spicy', 'What’s a compliment about your body you’d love to hear more often?'),
('spicy', 'Describe your ideal slow evening in with me — from start to finish.'),
('spicy', 'What’s a small touch from me that melts you every time?'),
('spicy', 'What’s something you’ve always wanted to try together but never said?'),
('spicy', 'When we’re apart, what do you miss most about being close to me?'),
('spicy', 'What’s the most flirty text I’ve ever sent you?'),
('spicy', 'What does the perfect goodnight kiss feel like to you?'),
('spicy', 'What’s a date-night idea that would make you blush?'),
('spicy', 'What song puts you in the mood?'),
('spicy', 'What’s your favourite way for me to greet you after time apart?'),
('spicy', 'What makes you feel most desired by me?'),
('spicy', 'Where would you want me to leave a trail of kisses?'),
('spicy', 'What’s something you find attractive about me that’s not physical?'),
('spicy', 'What’s a fantasy date you’d want to plan for us — money no object?'),
('spicy', 'What’s one thing you’d love me to whisper to you?'),
('spicy', 'What’s the best kiss we’ve ever had, and what made it so good?');

insert into public.mission_templates (category, duration, text) values
-- romantic (7)
('romantic', 'today', 'Leave a note somewhere they’ll find it.'),
('romantic', 'quick', 'Compliment something they’ve never been complimented on.'),
('romantic', 'today', 'Send them a photo of something that reminded you of them — no explanation.'),
('romantic', 'weekend', 'Plan a tiny surprise date without telling them it’s a date.'),
('romantic', 'quick', 'Tell them one specific thing you love about how they treat people.'),
('romantic', 'today', 'Find an old photo of the two of you and send it with one line about that day.'),
('romantic', 'today', 'Make them a playlist of five songs that feel like them.'),
-- funny (7)
('funny', 'today', 'Make them laugh without telling them why.'),
('funny', 'today', 'Slip a completely made-up fun fact into conversation and see if they believe it.'),
('funny', 'quick', 'Send them the worst pun you can find, with total confidence.'),
('funny', 'today', 'Use the same random word in three different conversations with them.'),
('funny', 'today', 'Reply to one message only in movie quotes.'),
('funny', 'quick', 'Send a dramatic voice note narrating what you’re doing, nature-documentary style.'),
('funny', 'weekend', 'Recreate a cheesy couple photo pose and send it with a straight face.'),
-- deep (6)
('deep', 'today', 'Ask them one question you’ve never asked before, and really listen.'),
('deep', 'today', 'Tell them about a moment this week when you thought of them.'),
('deep', 'quick', 'Thank them for something they did that they probably think you didn’t notice.'),
('deep', 'weekend', 'Write down three things you’ve learned from them and give it to them.'),
('deep', 'today', 'Share one worry you’ve been carrying, however small.'),
('deep', 'today', 'Tell them how they’ve changed your life, in one sentence.'),
-- chaotic (6)
('chaotic', 'today', 'Change your contact name in their phone (or yours) to something ridiculous — keep it until they notice.'),
('chaotic', 'quick', 'Send them a very serious-sounding message that turns out to be about a snack.'),
('chaotic', 'today', 'Start a conversation with “I have something important to tell you…” and make it wholesome.'),
('chaotic', 'today', 'Hide a tiny drawing somewhere they’ll find it later.'),
('chaotic', 'quick', 'Send three unrelated emojis and refuse to explain.'),
('chaotic', 'weekend', 'Plan a “mystery outing” with three clues sent through the day.'),
-- flirty (7)
('flirty', 'quick', 'Send them a text you’d normally be too shy to send.'),
('flirty', 'today', 'Give them a compliment only about their smile — three times today, three different ways.'),
('flirty', 'today', 'Wear something you know they like and don’t mention it.'),
('flirty', 'quick', 'Tell them the exact moment you knew you liked them.'),
('flirty', 'today', 'Send a voice note saying goodnight in your softest voice.'),
('flirty', 'today', 'Catch their eye across a room (or a video call) and hold it until they laugh.'),
('flirty', 'quick', 'Text them “I can’t stop thinking about you” — and nothing else.'),
-- adventure (6)
('adventure', 'weekend', 'Take them somewhere neither of you has been — even if it’s a new street.'),
('adventure', 'today', 'Try a food neither of you has tasted and report back.'),
('adventure', 'weekend', 'Plan a sunrise or sunset walk and bring a snack.'),
('adventure', 'today', 'Say yes to the next small plan they suggest, no questions asked.'),
('adventure', 'weekend', 'Pick a random spot on the map within an hour and go.'),
('adventure', 'today', 'Take a photo of something beautiful you’d normally walk past, and send it.'),
-- long_distance (6)
('long_distance', 'today', 'Schedule a surprise “same time” moment: both drink tea (or coffee) on a call.'),
('long_distance', 'quick', 'Send them a photo of your view right now with one word.'),
('long_distance', 'weekend', 'Mail them something small — a note, a pressed flower, a sticker.'),
('long_distance', 'today', 'Watch the same video separately and text each other your reactions.'),
('long_distance', 'today', 'Record a two-minute voice note about your day for them to listen to before bed.'),
('long_distance', 'weekend', 'Plan a virtual date: same meal, same song, one call.'),
-- spicy (15)
('spicy', 'today', 'Send a teasing text in the middle of their day — keep it suggestive, not explicit.'),
('spicy', 'today', 'Tell them, in detail, how you’d like your next kiss to go.'),
('spicy', 'quick', 'Whisper (or voice-note) one thing you find irresistible about them.'),
('spicy', 'today', 'Give them a slow, unhurried massage — no rushing, no phones.'),
('spicy', 'today', 'Wear their favourite scent on you and let them notice.'),
('spicy', 'weekend', 'Plan a candlelit night in and send them only the dress code.'),
('spicy', 'quick', 'Send a voice note describing your favourite memory of the two of you alone.'),
('spicy', 'today', 'Kiss them somewhere unexpected — their wrist, their shoulder — and say nothing.'),
('spicy', 'today', 'Have an honest conversation about something you’d both like more of.'),
('spicy', 'weekend', 'Recreate your first kiss as closely as you can.'),
('spicy', 'quick', 'Text them the one word that describes how they make you feel right now.'),
('spicy', 'today', 'Leave a note that says what you’re planning for later — and only a hint.'),
('spicy', 'today', 'Slow dance with them to one song, lights low.'),
('spicy', 'quick', 'Tell them the outfit you want to see them in next time.'),
('spicy', 'weekend', 'Plan a “no phones after 9” evening just for the two of you.');

insert into public.roulette_challenges (mood, text) values
-- easy (8)
('easy', 'Send each other the last photo you took — no deleting first.'),
('easy', 'Say three things you love about today.'),
('easy', 'Swap your current favourite song.'),
('easy', 'Tell each other one thing that made you smile this week.'),
('easy', 'Share your screen time and guess each other’s top app first.'),
('easy', 'Describe your ideal breakfast together.'),
('easy', 'Name a place you’d love to take the other person.'),
('easy', 'Send your current mood as a GIF.'),
-- romantic (8)
('romantic', 'Tell them something you’ve been afraid to say.'),
('romantic', 'Recall the exact moment you fell for each other — out loud.'),
('romantic', 'Write each other a three-line love poem in five minutes.'),
('romantic', 'Hold eye contact for one full minute without laughing.'),
('romantic', 'Plan your dream date together in under three minutes.'),
('romantic', 'Tell them one thing you want to remember about today forever.'),
('romantic', 'Share the song that reminds you most of them, and why.'),
('romantic', 'Finish this sentence together: “Our love is like…”'),
-- funny (8)
('funny', 'Send the weirdest photo in your camera roll.'),
('funny', 'Describe each other without using beautiful, kind or funny.'),
('funny', 'Do your best impression of the other person.'),
('funny', 'Speak only in questions for the next three messages.'),
('funny', 'Rate each other’s most recent selfie like a harsh judge.'),
('funny', 'Invent a secret handshake (or a video-call version).'),
('funny', 'Tell the story of how you met — but as a fairy tale.'),
('funny', 'Each pick the other’s next meal, no vetoes.'),
-- chaotic (8)
('chaotic', 'Choose each other’s profile picture for 24 hours.'),
('chaotic', 'Let the other person write your next status or story caption.'),
('chaotic', 'Swap phones for five minutes (no snooping in messages).'),
('chaotic', 'Talk in a fake accent until one of you laughs.'),
('chaotic', 'Send a voice note singing the chorus of a song they choose.'),
('chaotic', 'Let the other person rename you in their phone for a week.'),
('chaotic', 'Recreate a famous movie scene with whatever’s nearby.'),
('chaotic', 'Order (or cook) something with your eyes closed pointing at the menu.'),
-- hard (8)
('hard', 'Share one thing you’d change about how we argue.'),
('hard', 'Tell each other a habit that bothers you — gently.'),
('hard', 'Talk for five minutes about your biggest worry for us, then five about your biggest hope.'),
('hard', 'Each name one thing you need more of, and one thing you can give more of.'),
('hard', 'Apologise for something small you never apologised for.'),
('hard', 'Describe a time you felt misunderstood by the other.'),
('hard', 'Say what you’re most scared of losing.'),
('hard', 'Answer honestly: what do you wish we did more often?'),
-- spicy (12)
('spicy', 'Send a voice note describing what you’d do if they were next to you right now.'),
('spicy', 'Take turns naming something you find irresistible about each other — first to blush loses.'),
('spicy', 'Kiss for ten full seconds — or describe exactly how you would, if you’re apart.'),
('spicy', 'Give each other a two-minute shoulder massage.'),
('spicy', 'Tell them the most attractive thing they did this week.'),
('spicy', 'Pick tonight’s mood: candles, music, and one rule each.'),
('spicy', 'Whisper one thing you want to do on your next date night.'),
('spicy', 'Share a fantasy date in three sentences.'),
('spicy', 'Slow dance to the next song that plays.'),
('spicy', 'Text them a compliment you’d only say in private.'),
('spicy', 'Trade five kisses — each one somewhere different.'),
('spicy', 'Tell them what you were thinking the last time you stared at them.');

commit;
