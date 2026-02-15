-- Study groups + membership + invites (Supabase Postgres)

create table if not exists public.study_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  avatar text,
  creator_id uuid not null references auth.users(id) on delete cascade,
  max_members int not null default 10,
  settings jsonb not null default jsonb_build_object(
    'isPrivate', false,
    'allowMemberInvites', false,
    'requireApproval', false
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_study_groups_updated_at on public.study_groups;
create trigger set_study_groups_updated_at
before update on public.study_groups
for each row
execute procedure public.set_updated_at();

create index if not exists study_groups_creator_idx on public.study_groups(creator_id);
create index if not exists study_groups_created_at_idx on public.study_groups(created_at desc);

create table if not exists public.study_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_group_members_group_user_uniq unique (group_id, user_id)
);

drop trigger if exists set_study_group_members_updated_at on public.study_group_members;
create trigger set_study_group_members_updated_at
before update on public.study_group_members
for each row
execute procedure public.set_updated_at();

create index if not exists study_group_members_group_idx on public.study_group_members(group_id);
create index if not exists study_group_members_user_idx on public.study_group_members(user_id);
create index if not exists study_group_members_role_idx on public.study_group_members(role);

create table if not exists public.study_group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_group_invites_group_invitee_status_uniq unique (group_id, invitee_id, status)
);

drop trigger if exists set_study_group_invites_updated_at on public.study_group_invites;
create trigger set_study_group_invites_updated_at
before update on public.study_group_invites
for each row
execute procedure public.set_updated_at();

create index if not exists study_group_invites_invitee_status_idx on public.study_group_invites(invitee_id, status);
create index if not exists study_group_invites_group_status_idx on public.study_group_invites(group_id, status);

-- RLS (baseline; backend uses service_role)
alter table public.study_groups enable row level security;
alter table public.study_group_members enable row level security;
alter table public.study_group_invites enable row level security;

drop policy if exists "study_groups_select_member_or_public" on public.study_groups;
create policy "study_groups_select_member_or_public" on public.study_groups
for select
using (
  (coalesce((settings->>'isPrivate')::boolean, false) = false)
  or exists (
    select 1 from public.study_group_members m
    where m.group_id = study_groups.id and m.user_id = auth.uid()
  )
);

drop policy if exists "study_groups_insert_own" on public.study_groups;
create policy "study_groups_insert_own" on public.study_groups
for insert
with check (auth.uid() = creator_id);

drop policy if exists "study_groups_update_admin" on public.study_groups;
create policy "study_groups_update_admin" on public.study_groups
for update
using (
  exists (
    select 1 from public.study_group_members m
    where m.group_id = study_groups.id and m.user_id = auth.uid()
      and m.role in ('creator','admin')
  )
)
with check (
  exists (
    select 1 from public.study_group_members m
    where m.group_id = study_groups.id and m.user_id = auth.uid()
      and m.role in ('creator','admin')
  )
);

drop policy if exists "study_group_members_select" on public.study_group_members;
create policy "study_group_members_select" on public.study_group_members
for select
using (
  exists (
    select 1 from public.study_group_members me
    where me.group_id = study_group_members.group_id and me.user_id = auth.uid()
  )
);

drop policy if exists "study_group_members_insert_self_or_admin" on public.study_group_members;
create policy "study_group_members_insert_self_or_admin" on public.study_group_members
for insert
with check (
  auth.uid() = user_id
  or exists (
    select 1 from public.study_group_members m
    where m.group_id = study_group_members.group_id and m.user_id = auth.uid()
      and m.role in ('creator','admin')
  )
);

drop policy if exists "study_group_members_update_admin" on public.study_group_members;
create policy "study_group_members_update_admin" on public.study_group_members
for update
using (
  exists (
    select 1 from public.study_group_members m
    where m.group_id = study_group_members.group_id and m.user_id = auth.uid()
      and m.role in ('creator','admin')
  )
)
with check (
  exists (
    select 1 from public.study_group_members m
    where m.group_id = study_group_members.group_id and m.user_id = auth.uid()
      and m.role in ('creator','admin')
  )
);

drop policy if exists "study_group_members_delete_self_or_admin" on public.study_group_members;
create policy "study_group_members_delete_self_or_admin" on public.study_group_members
for delete
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.study_group_members m
    where m.group_id = study_group_members.group_id and m.user_id = auth.uid()
      and m.role in ('creator','admin')
  )
);

drop policy if exists "study_group_invites_select" on public.study_group_invites;
create policy "study_group_invites_select" on public.study_group_invites
for select
using (
  auth.uid() = invitee_id
  or auth.uid() = inviter_id
);

drop policy if exists "study_group_invites_insert_inviter" on public.study_group_invites;
create policy "study_group_invites_insert_inviter" on public.study_group_invites
for insert
with check (
  auth.uid() = inviter_id
);

drop policy if exists "study_group_invites_update_invitee" on public.study_group_invites;
create policy "study_group_invites_update_invitee" on public.study_group_invites
for update
using (auth.uid() = invitee_id)
with check (auth.uid() = invitee_id);

