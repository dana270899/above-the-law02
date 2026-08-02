drop policy if exists "public completed-run insert" on public.leaderboard_entries;

create policy "public completed-run insert"
on public.leaderboard_entries
for insert
to anon, authenticated
with check (
  jsonb_typeof(case_breakdown) = 'array'
  and jsonb_array_length(case_breakdown) between 0 and 7
  and (photo_path is null or photo_path ~ '^profiles/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
);
