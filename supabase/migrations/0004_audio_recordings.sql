-- 0004: Audio recordings metadata (Supabase Storage)

create table if not exists public.audio_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  recording_type text not null check (recording_type in ('practice', 'simulation')),
  bucket text not null default 'audio',
  object_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null default 0,
  duration_seconds int not null default 0,
  topic text,
  test_part text,
  overall_band numeric,
  scores jsonb,
  storage_provider text not null default 'supabase',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audio_recordings_user_object_uniq unique (user_id, object_path)
);

drop trigger if exists set_audio_recordings_updated_at on public.audio_recordings;
create trigger set_audio_recordings_updated_at
before update on public.audio_recordings
for each row
execute procedure public.set_updated_at();

create index if not exists audio_recordings_user_idx on public.audio_recordings(user_id, created_at desc);
create index if not exists audio_recordings_session_idx on public.audio_recordings(user_id, session_id);

alter table public.audio_recordings enable row level security;

drop policy if exists "audio_recordings_select_own" on public.audio_recordings;
create policy "audio_recordings_select_own" on public.audio_recordings for select using (auth.uid() = user_id);
drop policy if exists "audio_recordings_insert_own" on public.audio_recordings;
create policy "audio_recordings_insert_own" on public.audio_recordings for insert with check (auth.uid() = user_id);
drop policy if exists "audio_recordings_update_own" on public.audio_recordings;
create policy "audio_recordings_update_own" on public.audio_recordings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "audio_recordings_delete_own" on public.audio_recordings;
create policy "audio_recordings_delete_own" on public.audio_recordings for delete using (auth.uid() = user_id);

