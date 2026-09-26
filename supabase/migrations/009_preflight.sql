select 'dup responses' as check, daily_activity_id, user_id, count(*) from public.activity_responses group by 2,3 having count(*) > 1;
select 'null couple_id memories', count(*) from public.memories where couple_id is null;
select 'null couple_id daily_activities', count(*) from public.daily_activities where couple_id is null;
select 'null couple_id important_dates', count(*) from public.important_dates where couple_id is null;
select 'null couple_id bottles', count(*) from public.bottles where couple_id is null;
select 'null couple_id missions', count(*) from public.missions where couple_id is null;
select 'null memory_id media', count(*) from public.memory_media where memory_id is null;
select 'null memory_id reflections', count(*) from public.memory_reflections where memory_id is null;
select 'null fields responses', count(*) from public.activity_responses where daily_activity_id is null or user_id is null;
