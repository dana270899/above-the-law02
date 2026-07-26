create extension if not exists pgcrypto;

create table if not exists public.leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  player_name text not null check (char_length(player_name) between 1 and 60),
  photo_path text,
  score integer not null check (score between 0 and 100000),
  winning_target integer not null check (winning_target between 1 and 100000),
  won boolean not null,
  case_breakdown jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists leaderboard_entries_score_created_at_idx
on public.leaderboard_entries (score desc, created_at asc);

create or replace function public.validate_leaderboard_entry() returns trigger language plpgsql set search_path = '' as $$
declare calculated_score integer;
declare invalid_items integer;
declare distinct_cases integer;
begin
  select coalesce(sum((item->>'totalPoints')::integer), 0) into calculated_score
  from jsonb_array_elements(new.case_breakdown) item;

  select count(*) into invalid_items
  from jsonb_array_elements(new.case_breakdown) item
  where jsonb_typeof(item) <> 'object'
     or coalesce(item->>'caseId', '') = ''
     or coalesce(item->>'title', '') = ''
     or coalesce((item->>'attempt')::integer, 0) not in (1, 2)
     or coalesce((item->>'elapsedSeconds')::numeric, -1) < 0
     or coalesce((item->>'basePoints')::integer, -1) < 0
     or coalesce((item->>'speedPoints')::integer, -1) < 0
     or coalesce((item->>'totalPoints')::integer, -1) < 0
     or (item->>'totalPoints')::integer <> (item->>'basePoints')::integer + (item->>'speedPoints')::integer
     or ((item->>'correct')::boolean = false and (
       (item->>'basePoints')::integer <> 0 or
       (item->>'speedPoints')::integer <> 0 or
       (item->>'totalPoints')::integer <> 0
     ));

  select count(distinct item->>'caseId') into distinct_cases
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

drop trigger if exists validate_leaderboard_entry on public.leaderboard_entries;
create trigger validate_leaderboard_entry before insert on public.leaderboard_entries for each row execute function public.validate_leaderboard_entry();

alter table public.leaderboard_entries enable row level security;
revoke all on public.leaderboard_entries from anon, authenticated;
grant select, insert on public.leaderboard_entries to anon, authenticated;
drop policy if exists "public leaderboard read" on public.leaderboard_entries;
drop policy if exists "public completed-run insert" on public.leaderboard_entries;
create policy "public leaderboard read" on public.leaderboard_entries for select to anon, authenticated using (true);
create policy "public completed-run insert" on public.leaderboard_entries for insert to anon, authenticated
with check (
  jsonb_typeof(case_breakdown) = 'array'
  and jsonb_array_length(case_breakdown) = 7
  and (photo_path is null or photo_path ~ '^profiles/[0-9a-f-]{36}\\.(jpg|jpeg|png|webp)$')
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('leaderboard-photos', 'leaderboard-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "public leaderboard photo read" on storage.objects;
drop policy if exists "public leaderboard photo insert" on storage.objects;
create policy "public leaderboard photo read" on storage.objects for select to anon, authenticated using (bucket_id = 'leaderboard-photos');
create policy "public leaderboard photo insert" on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'leaderboard-photos'
  and (storage.foldername(name))[1] = 'profiles'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);
