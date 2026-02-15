-- 0005: Streak tracking support in user_stats

alter table public.user_stats
  add column if not exists last_practice_at timestamptz;

create index if not exists user_stats_last_practice_idx on public.user_stats(last_practice_at desc);

