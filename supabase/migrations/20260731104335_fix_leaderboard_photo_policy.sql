alter table public.leaderboard_entries
drop constraint if exists leaderboard_entries_score_check;

alter table public.leaderboard_entries
add constraint leaderboard_entries_score_check
check (score between -100000 and 100000);

create or replace function public.validate_leaderboard_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  calculated_score integer;
  invalid_items integer;
  distinct_cases integer;
begin
  select coalesce(sum((item->>'totalPoints')::integer), 0)
  into calculated_score
  from jsonb_array_elements(new.case_breakdown) item;

  select count(*)
  into invalid_items
  from jsonb_array_elements(new.case_breakdown) item
  where jsonb_typeof(item) <> 'object'
     or coalesce(item->>'caseId', '') = ''
     or coalesce(item->>'title', '') = ''
     or coalesce((item->>'attempt')::integer, 0) not in (1, 2)
     or coalesce((item->>'elapsedSeconds')::numeric, -1) < 0
     or coalesce((item->>'basePoints')::integer, -100001) not between -100000 and 100000
     or coalesce((item->>'speedPoints')::integer, -1) not between 0 and 100000
     or coalesce((item->>'totalPoints')::integer, -100001) not between -100000 and 100000
     or coalesce(item->>'correct', '') not in ('true', 'false')
     or (item->>'totalPoints')::integer <> (item->>'basePoints')::integer + (item->>'speedPoints')::integer
     or ((item->>'correct')::boolean = false and (
       (item->>'speedPoints')::integer <> 0 or
       (item->>'totalPoints')::integer <> (item->>'basePoints')::integer
     ));

  select count(distinct item->>'caseId')
  into distinct_cases
  from jsonb_array_elements(new.case_breakdown) item;

  if invalid_items > 0
     or distinct_cases <> jsonb_array_length(new.case_breakdown)
     or calculated_score <> new.score
     or new.won <> (new.score >= new.winning_target) then
    raise exception 'Invalid leaderboard score';
  end if;

  return new;
end;
$$;

revoke execute on function public.validate_leaderboard_entry() from public, anon, authenticated;

drop policy if exists "public completed-run insert" on public.leaderboard_entries;
create policy "public completed-run insert"
on public.leaderboard_entries
for insert
to anon, authenticated
with check (
  jsonb_typeof(case_breakdown) = 'array'
  and jsonb_array_length(case_breakdown) = 7
  and (
    photo_path is null
    or photo_path ~ '^profiles/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
  )
);
