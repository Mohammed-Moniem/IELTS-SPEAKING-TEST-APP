-- 0006: Generic favorites (topics, question bank, sessions, simulations, recordings)

do $$
begin
  if not exists (select 1 from pg_type where typname = 'favorite_entity') then
    create type public.favorite_entity as enum (
      'topic',
      'ielts_question',
      'practice_session',
      'test_simulation',
      'audio_recording'
    );
  end if;
end $$;

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type public.favorite_entity not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  constraint favorites_user_entity_uniq unique (user_id, entity_type, entity_id)
);

create index if not exists favorites_user_idx on public.favorites(user_id, created_at desc);
create index if not exists favorites_user_entity_idx on public.favorites(user_id, entity_type, created_at desc);

alter table public.favorites enable row level security;

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own" on public.favorites for select using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own" on public.favorites for insert with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own" on public.favorites for delete using (auth.uid() = user_id);

