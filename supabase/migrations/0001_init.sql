-- Spokio initial schema (Supabase Postgres)
-- Notes:
-- - Auth users live in auth.users (managed by Supabase Auth).
-- - App tables live in public.* and reference auth.users(id).
-- - Service-role requests bypass RLS; RLS is still enabled for future direct-client access.

-- Extensions
create extension if not exists pgcrypto;

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_plan') then
    create type public.subscription_plan as enum ('free', 'premium', 'pro');
  end if;

  if not exists (select 1 from pg_type where typname = 'topic_difficulty') then
    create type public.topic_difficulty as enum ('beginner', 'intermediate', 'advanced');
  end if;

  if not exists (select 1 from pg_type where typname = 'ielts_part') then
    create type public.ielts_part as enum ('part1', 'part2', 'part3');
  end if;

  if not exists (select 1 from pg_type where typname = 'question_difficulty') then
    create type public.question_difficulty as enum ('easy', 'medium', 'hard');
  end if;

  if not exists (select 1 from pg_type where typname = 'session_status') then
    create type public.session_status as enum ('in_progress', 'completed');
  end if;
end $$;

-- Utility: updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles (lightweight auth-linked user record)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null default 'Guest',
  last_name text not null default 'User',
  phone text,
  email_verified boolean not null default false,
  subscription_plan public.subscription_plan not null default 'free',
  is_guest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute procedure public.set_updated_at();

-- User profiles (social/extended settings used by the mobile app)
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null unique,
  avatar text,
  bio text,
  ielts_info jsonb not null default '{}'::jsonb,
  study_goals jsonb not null default '{}'::jsonb,
  social jsonb not null default jsonb_build_object(
    'qrCode', null,
    'allowFriendSuggestions', true,
    'showOnlineStatus', true,
    'allowDirectMessages', true
  ),
  privacy jsonb not null default jsonb_build_object(
    'profileVisibility', 'friends-only',
    'leaderboardOptIn', false,
    'showStatistics', true,
    'showActivity', true,
    'showStudyGoals', true
  ),
  badges text[] not null default '{}',
  level int not null default 1,
  xp int not null default 0,
  last_active timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute procedure public.set_updated_at();

create index if not exists user_profiles_user_id_idx on public.user_profiles(user_id);

-- Auto-provision profile rows when a new auth user is created
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  derived_email text;
  derived_first text;
  derived_last text;
begin
  derived_email := coalesce(new.email, 'guest+' || new.id::text || '@anon.spokio.local');
  derived_first := coalesce(new.raw_user_meta_data->>'firstName', new.raw_user_meta_data->>'first_name', 'Guest');
  derived_last := coalesce(new.raw_user_meta_data->>'lastName', new.raw_user_meta_data->>'last_name', 'User');

  insert into public.profiles (id, email, first_name, last_name, phone, email_verified, subscription_plan, is_guest)
  values (
    new.id,
    derived_email,
    derived_first,
    derived_last,
    nullif(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.email_confirmed_at is not null, false),
    'free',
    new.email is null
  )
  on conflict (id) do update set
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email_verified = excluded.email_verified,
    is_guest = excluded.is_guest,
    updated_at = now();

  base_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);

  insert into public.user_profiles (user_id, username)
  values (new.id, base_username)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_auth_user();

-- Content: Topics
create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  part int not null,
  category text not null,
  difficulty public.topic_difficulty not null,
  is_premium boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_topics_updated_at on public.topics;
create trigger set_topics_updated_at
before update on public.topics
for each row
execute procedure public.set_updated_at();

create index if not exists topics_part_idx on public.topics(part);
create index if not exists topics_category_idx on public.topics(category);
create index if not exists topics_difficulty_idx on public.topics(difficulty);

-- Content: IELTS question bank
create table if not exists public.ielts_questions (
  id uuid primary key default gen_random_uuid(),
  category public.ielts_part not null,
  difficulty public.question_difficulty not null,
  question text not null,
  follow_up_questions text[] not null default '{}',
  cue_card jsonb,
  related_topics text[] not null default '{}',
  keywords text[] not null default '{}',
  topic text not null,
  source text,
  times_used int not null default 0,
  last_used_at timestamptz,
  verified boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ielts_questions_category_question_uniq unique (category, question)
);

drop trigger if exists set_ielts_questions_updated_at on public.ielts_questions;
create trigger set_ielts_questions_updated_at
before update on public.ielts_questions
for each row
execute procedure public.set_updated_at();

create index if not exists ielts_questions_active_idx on public.ielts_questions(active);
create index if not exists ielts_questions_topic_idx on public.ielts_questions(topic);
create index if not exists ielts_questions_category_difficulty_idx on public.ielts_questions(category, difficulty);

-- Practice sessions
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  topic_title text not null,
  question text not null,
  part int not null,
  category text,
  difficulty text,
  status public.session_status not null default 'in_progress',
  user_response text,
  audio_path text,
  transcription jsonb,
  time_spent int,
  feedback jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_practice_sessions_updated_at on public.practice_sessions;
create trigger set_practice_sessions_updated_at
before update on public.practice_sessions
for each row
execute procedure public.set_updated_at();

create index if not exists practice_sessions_user_idx on public.practice_sessions(user_id);
create index if not exists practice_sessions_status_idx on public.practice_sessions(status);
create index if not exists practice_sessions_started_at_idx on public.practice_sessions(started_at desc);

-- Test simulations (mock tests)
create table if not exists public.test_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.session_status not null default 'in_progress',
  parts jsonb not null default '[]'::jsonb,
  overall_feedback jsonb,
  overall_band numeric,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_test_simulations_updated_at on public.test_simulations;
create trigger set_test_simulations_updated_at
before update on public.test_simulations
for each row
execute procedure public.set_updated_at();

create index if not exists test_simulations_user_idx on public.test_simulations(user_id);
create index if not exists test_simulations_started_at_idx on public.test_simulations(started_at desc);

-- Test evaluations (optional; feedback can also live inline in sessions/simulations)
create table if not exists public.test_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_session_id uuid references public.practice_sessions(id) on delete cascade,
  test_simulation_id uuid references public.test_simulations(id) on delete cascade,
  overall_band numeric not null,
  criteria jsonb not null,
  corrections jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  spoken_summary text,
  detailed_feedback text,
  evaluator_model text,
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_test_evaluations_updated_at on public.test_evaluations;
create trigger set_test_evaluations_updated_at
before update on public.test_evaluations
for each row
execute procedure public.set_updated_at();

create index if not exists test_evaluations_user_idx on public.test_evaluations(user_id);

-- Usage records (for free plan enforcement)
create table if not exists public.usage_records (
  user_id uuid primary key references auth.users(id) on delete cascade,
  practice_count int not null default 0,
  test_count int not null default 0,
  last_reset timestamptz not null default now(),
  monthly_resets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_usage_records_updated_at on public.usage_records;
create trigger set_usage_records_updated_at
before update on public.usage_records
for each row
execute procedure public.set_updated_at();

-- Notification preferences
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_reminder_enabled boolean not null default true,
  daily_reminder_hour int not null default 19,
  daily_reminder_minute int not null default 0,
  achievements_enabled boolean not null default true,
  streak_reminders_enabled boolean not null default true,
  inactivity_reminders_enabled boolean not null default true,
  feedback_notifications_enabled boolean not null default true,
  direct_messages_enabled boolean not null default true,
  group_messages_enabled boolean not null default true,
  system_announcements_enabled boolean not null default true,
  offers_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row
execute procedure public.set_updated_at();

-- Device tokens (push notifications)
create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_device_tokens_updated_at on public.device_tokens;
create trigger set_device_tokens_updated_at
before update on public.device_tokens
for each row
execute procedure public.set_updated_at();

create index if not exists device_tokens_user_idx on public.device_tokens(user_id);

-- Preferences (IELTS test preferences)
create table if not exists public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  test_date date,
  target_band text,
  time_frame text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_preferences_updated_at on public.preferences;
create trigger set_preferences_updated_at
before update on public.preferences
for each row
execute procedure public.set_updated_at();

-- Social: friend requests and friendships (minimal; business logic is enforced in API)
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friend_requests_sender_receiver_uniq unique (sender_id, receiver_id)
);

drop trigger if exists set_friend_requests_updated_at on public.friend_requests;
create trigger set_friend_requests_updated_at
before update on public.friend_requests
for each row
execute procedure public.set_updated_at();

create index if not exists friend_requests_receiver_status_idx on public.friend_requests(receiver_id, status);
create index if not exists friend_requests_sender_status_idx on public.friend_requests(sender_id, status);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid not null references auth.users(id) on delete cascade,
  user2_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint friendships_pair_uniq unique (user1_id, user2_id)
);

create index if not exists friendships_user1_idx on public.friendships(user1_id);
create index if not exists friendships_user2_idx on public.friendships(user2_id);

-- Referrals
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete set null,
  referral_code text not null,
  email text,
  status text not null default 'pending',
  rewards jsonb not null default jsonb_build_object(
    'practiceSessionsGranted', 0,
    'simulationSessionsGranted', 0,
    'grantedAt', null,
    'pointsGranted', false,
    'pointsGrantedAt', null
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_referrals_updated_at on public.referrals;
create trigger set_referrals_updated_at
before update on public.referrals
for each row
execute procedure public.set_updated_at();

create index if not exists referrals_referrer_idx on public.referrals(referrer_id);
create index if not exists referrals_code_status_idx on public.referrals(referral_code, status);

create table if not exists public.referral_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  referral_code text not null unique,
  total_referrals int not null default 0,
  successful_referrals int not null default 0,
  pending_referrals int not null default 0,
  today_referrals int not null default 0,
  last_referral_date date,
  lifetime_earnings jsonb not null default jsonb_build_object('practices', 0, 'simulations', 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_referral_stats_updated_at on public.referral_stats;
create trigger set_referral_stats_updated_at
before update on public.referral_stats
for each row
execute procedure public.set_updated_at();

-- Achievements + user achievements + stats (minimal schema)
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null,
  category text not null,
  tier text,
  icon text not null,
  points int not null default 10,
  requirement jsonb not null,
  is_premium boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_achievements_updated_at on public.achievements;
create trigger set_achievements_updated_at
before update on public.achievements
for each row
execute procedure public.set_updated_at();

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null,
  progress int not null default 0,
  is_unlocked boolean not null default false,
  unlocked_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_achievements_user_key_uniq unique (user_id, achievement_key)
);

drop trigger if exists set_user_achievements_updated_at on public.user_achievements;
create trigger set_user_achievements_updated_at
before update on public.user_achievements
for each row
execute procedure public.set_updated_at();

create table if not exists public.user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_practice_sessions int not null default 0,
  total_simulations int not null default 0,
  average_score numeric not null default 0,
  highest_score numeric not null default 0,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  total_achievements int not null default 0,
  achievement_points int not null default 0,
  total_points int not null default 0,
  redeemed_points int not null default 0,
  weekly_score numeric not null default 0,
  monthly_score numeric not null default 0,
  weekly_practices int not null default 0,
  monthly_practices int not null default 0,
  leaderboard_opt_in boolean not null default false,
  profile_visibility text not null default 'friends-only',
  last_points_update timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_user_stats_updated_at on public.user_stats;
create trigger set_user_stats_updated_at
before update on public.user_stats
for each row
execute procedure public.set_updated_at();

-- Chat (minimal persistence; encryption happens at application layer)
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete set null,
  group_id uuid,
  encrypted_content text not null,
  iv text not null,
  message_type text not null default 'text',
  is_edited boolean not null default false,
  is_deleted boolean not null default false,
  read_by uuid[] not null default '{}',
  delivered_to uuid[] not null default '{}',
  reactions jsonb not null default '{}'::jsonb,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_chat_messages_updated_at on public.chat_messages;
create trigger set_chat_messages_updated_at
before update on public.chat_messages
for each row
execute procedure public.set_updated_at();

create index if not exists chat_messages_conversation_idx on public.chat_messages(conversation_id, created_at desc);

create table if not exists public.conversations (
  conversation_id text primary key,
  participants uuid[] not null,
  is_group_chat boolean not null default false,
  group_id uuid,
  last_message jsonb,
  unread_count jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row
execute procedure public.set_updated_at();

create index if not exists conversations_updated_at_idx on public.conversations(updated_at desc);

-- Realtime presence
create table if not exists public.user_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_online boolean not null default false,
  last_seen timestamptz,
  socket_ids text[] not null default '{}',
  currently_typing_in text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- RLS (baseline self-access)
alter table public.profiles enable row level security;
alter table public.user_profiles enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.test_simulations enable row level security;
alter table public.test_evaluations enable row level security;
alter table public.usage_records enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.device_tokens enable row level security;
alter table public.preferences enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_stats enable row level security;
alter table public.user_achievements enable row level security;
alter table public.user_stats enable row level security;
alter table public.chat_messages enable row level security;
alter table public.conversations enable row level security;
alter table public.user_status enable row level security;

-- Content tables can be readable by all.
alter table public.topics enable row level security;
alter table public.ielts_questions enable row level security;
alter table public.achievements enable row level security;

-- Profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- User profiles
drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own" on public.user_profiles for select using (auth.uid() = user_id);
drop policy if exists "user_profiles_update_own" on public.user_profiles;
create policy "user_profiles_update_own" on public.user_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "user_profiles_insert_own" on public.user_profiles;
create policy "user_profiles_insert_own" on public.user_profiles for insert with check (auth.uid() = user_id);

-- Topics / Question bank / Achievements are readable (and writable only by service role)
drop policy if exists "topics_select_all" on public.topics;
create policy "topics_select_all" on public.topics for select using (true);
drop policy if exists "ielts_questions_select_all" on public.ielts_questions;
create policy "ielts_questions_select_all" on public.ielts_questions for select using (true);
drop policy if exists "achievements_select_all" on public.achievements;
create policy "achievements_select_all" on public.achievements for select using (true);

-- Practice sessions
drop policy if exists "practice_sessions_select_own" on public.practice_sessions;
create policy "practice_sessions_select_own" on public.practice_sessions for select using (auth.uid() = user_id);
drop policy if exists "practice_sessions_insert_own" on public.practice_sessions;
create policy "practice_sessions_insert_own" on public.practice_sessions for insert with check (auth.uid() = user_id);
drop policy if exists "practice_sessions_update_own" on public.practice_sessions;
create policy "practice_sessions_update_own" on public.practice_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Simulations
drop policy if exists "test_simulations_select_own" on public.test_simulations;
create policy "test_simulations_select_own" on public.test_simulations for select using (auth.uid() = user_id);
drop policy if exists "test_simulations_insert_own" on public.test_simulations;
create policy "test_simulations_insert_own" on public.test_simulations for insert with check (auth.uid() = user_id);
drop policy if exists "test_simulations_update_own" on public.test_simulations;
create policy "test_simulations_update_own" on public.test_simulations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Usage
drop policy if exists "usage_records_select_own" on public.usage_records;
create policy "usage_records_select_own" on public.usage_records for select using (auth.uid() = user_id);
drop policy if exists "usage_records_upsert_own" on public.usage_records;
create policy "usage_records_upsert_own" on public.usage_records for insert with check (auth.uid() = user_id);
drop policy if exists "usage_records_update_own" on public.usage_records;
create policy "usage_records_update_own" on public.usage_records for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

