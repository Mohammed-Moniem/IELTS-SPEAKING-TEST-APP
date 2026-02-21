-- Supabase migration: create document tables used by the Mongo-compat adapter.
-- IDs remain 24-char text values to preserve existing API contracts.

create extension if not exists pgcrypto;

create or replace function public.create_doc_table(table_name text)
returns void
language plpgsql
as $$
begin
  execute format(
    'create table if not exists %I (
      id text primary key,
      data jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )',
    table_name
  );

  execute format('create index if not exists %I on %I (updated_at desc)', table_name || '_updated_at_idx', table_name);
  execute format('create index if not exists %I on %I using gin (data)', table_name || '_data_gin_idx', table_name);
end;
$$;

select public.create_doc_table('users');
select public.create_doc_table('user_profiles');
select public.create_doc_table('user_statuses');
select public.create_doc_table('friend_requests');
select public.create_doc_table('friendships');
select public.create_doc_table('conversations');
select public.create_doc_table('chat_messages');
select public.create_doc_table('study_groups');
select public.create_doc_table('study_group_invites');
select public.create_doc_table('topics');
select public.create_doc_table('practice_sessions');
select public.create_doc_table('test_preferences');
select public.create_doc_table('test_simulations');
select public.create_doc_table('test_sessions');
select public.create_doc_table('test_evaluations');
select public.create_doc_table('ielts_questions');
select public.create_doc_table('generated_questions');
select public.create_doc_table('user_question_history');
select public.create_doc_table('subscriptions');
select public.create_doc_table('usage_records');
select public.create_doc_table('achievements');
select public.create_doc_table('user_achievements');
select public.create_doc_table('user_stats');
select public.create_doc_table('referrals');
select public.create_doc_table('user_referral_stats');
select public.create_doc_table('coupons');
select public.create_doc_table('coupon_usages');
select public.create_doc_table('points_transactions');
select public.create_doc_table('discount_redemptions');
select public.create_doc_table('test_history');
select public.create_doc_table('audio_recordings');
select public.create_doc_table('chat_files');

-- Core unique constraints mirrored from Mongoose schemas.
create unique index if not exists users_email_unique_idx on users (lower(data->>'email'));
create unique index if not exists user_profiles_user_id_unique_idx on user_profiles ((data->>'userId'));
create unique index if not exists user_profiles_username_unique_idx on user_profiles (lower(data->>'username'));
create unique index if not exists conversations_conversation_id_unique_idx on conversations ((data->>'conversationId'));
create unique index if not exists coupons_code_unique_idx on coupons (upper(data->>'code'));
create unique index if not exists referral_code_unique_idx on user_referral_stats (upper(data->>'referralCode'));

-- Social graph constraints.
create unique index if not exists friend_requests_sender_receiver_unique_idx
  on friend_requests ((data->>'senderId'), (data->>'receiverId'));
create unique index if not exists friendships_pair_unique_idx
  on friendships (
    least(data->>'user1Id', data->>'user2Id'),
    greatest(data->>'user1Id', data->>'user2Id')
  );

-- Useful lookup indexes.
create index if not exists chat_messages_conversation_idx on chat_messages ((data->>'conversationId'));
create index if not exists chat_messages_created_at_idx on chat_messages ((data->>'createdAt') desc);
create index if not exists practice_sessions_user_idx on practice_sessions ((data->>'user'));
create index if not exists test_simulations_user_idx on test_simulations ((data->>'user'));
create index if not exists test_sessions_user_idx on test_sessions ((data->>'userId'));
create index if not exists user_question_history_user_idx on user_question_history ((data->>'userId'));
create index if not exists generated_questions_expires_idx on generated_questions ((data->>'expiresAt'));
create index if not exists audio_recordings_user_idx on audio_recordings ((data->>'userId'));
create index if not exists chat_files_expiry_idx on chat_files ((data->>'expiresAt'));

-- Cleanup candidates (TTL replacement support).
create or replace view public.generated_questions_expired as
select id, data
from generated_questions
where nullif(data->>'expiresAt', '') is not null
  and (data->>'expiresAt')::timestamptz <= now();

create or replace view public.chat_files_expired as
select id, data
from chat_files
where nullif(data->>'expiresAt', '') is not null
  and (data->>'expiresAt')::timestamptz <= now();

create or replace view public.audio_recordings_expired as
select id, data
from audio_recordings
where nullif(data->>'expiresAt', '') is not null
  and (data->>'expiresAt')::timestamptz <= now();

-- Optional retention view for old user question history rows.
create or replace view public.user_question_history_retention as
select id, data
from user_question_history
where (data->>'usedAt')::timestamptz < now() - interval '90 days';
