-- 0007: Practice sessions support for voice source + audio linkage

alter table public.practice_sessions
  add column if not exists source text not null default 'practice';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'practice_sessions_source_check'
  ) then
    alter table public.practice_sessions
      add constraint practice_sessions_source_check
      check (source in ('practice', 'voice'));
  end if;
end $$;

alter table public.practice_sessions
  add column if not exists question_id uuid references public.ielts_questions(id) on delete set null;

alter table public.practice_sessions
  add column if not exists audio_recording_id uuid references public.audio_recordings(id) on delete set null;

create index if not exists practice_sessions_user_created_idx on public.practice_sessions(user_id, created_at desc);
create index if not exists practice_sessions_user_source_created_idx on public.practice_sessions(user_id, source, created_at desc);

