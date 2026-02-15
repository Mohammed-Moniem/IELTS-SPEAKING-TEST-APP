-- 0002: Analytics test history + keep profiles in sync when auth.users changes

-- Keep profile fields in sync when an auth user is updated (email/linking identities).
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email, raw_user_meta_data, email_confirmed_at on auth.users
for each row
execute procedure public.handle_new_auth_user();

-- Analytics: store each evaluated attempt as a row (used by /analytics/* endpoints).
create table if not exists public.test_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  test_type text not null check (test_type in ('practice', 'simulation')),
  topic text not null,
  test_part text,
  duration_seconds int not null default 0,
  completed_at timestamptz not null default now(),
  overall_band numeric not null,
  criteria jsonb not null,
  corrections jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  audio_recording_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_test_history_updated_at on public.test_history;
create trigger set_test_history_updated_at
before update on public.test_history
for each row
execute procedure public.set_updated_at();

create index if not exists test_history_user_idx on public.test_history(user_id, created_at desc);
create index if not exists test_history_type_idx on public.test_history(user_id, test_type, created_at desc);
create index if not exists test_history_topic_idx on public.test_history(user_id, topic);

alter table public.test_history enable row level security;

drop policy if exists "test_history_select_own" on public.test_history;
create policy "test_history_select_own" on public.test_history for select using (auth.uid() = user_id);
drop policy if exists "test_history_insert_own" on public.test_history;
create policy "test_history_insert_own" on public.test_history for insert with check (auth.uid() = user_id);
drop policy if exists "test_history_update_own" on public.test_history;
create policy "test_history_update_own" on public.test_history for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

