-- 0008: In-app support tickets (repo-only support channel)

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_idx on public.support_tickets(user_id, created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists "support_tickets_select_own" on public.support_tickets;
create policy "support_tickets_select_own" on public.support_tickets for select using (auth.uid() = user_id);

drop policy if exists "support_tickets_insert_own" on public.support_tickets;
create policy "support_tickets_insert_own" on public.support_tickets for insert with check (auth.uid() = user_id);

