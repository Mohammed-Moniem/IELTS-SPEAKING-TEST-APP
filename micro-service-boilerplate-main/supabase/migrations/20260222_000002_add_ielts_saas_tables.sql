-- Adds document tables for web SaaS IELTS modules, feature flags, AI usage, and admin auditing.

select public.create_doc_table('writing_tasks');
select public.create_doc_table('writing_submissions');
select public.create_doc_table('reading_tests');
select public.create_doc_table('reading_attempts');
select public.create_doc_table('listening_tests');
select public.create_doc_table('listening_attempts');
select public.create_doc_table('full_exam_sessions');
select public.create_doc_table('feature_flags');
select public.create_doc_table('ai_usage_logs');
select public.create_doc_table('admin_audit_logs');

create unique index if not exists feature_flags_key_unique_idx on feature_flags (lower(data->>'key'));

create index if not exists writing_tasks_track_active_idx
  on writing_tasks ((data->>'track'), (data->>'taskType'), (data->>'active'));

create index if not exists writing_submissions_user_idx
  on writing_submissions ((data->>'userId'), (data->>'createdAt') desc);

create index if not exists reading_tests_track_active_idx
  on reading_tests ((data->>'track'), (data->>'active'));

create index if not exists reading_attempts_user_idx
  on reading_attempts ((data->>'userId'), (data->>'createdAt') desc);

create index if not exists listening_tests_track_active_idx
  on listening_tests ((data->>'track'), (data->>'active'));

create index if not exists listening_attempts_user_idx
  on listening_attempts ((data->>'userId'), (data->>'createdAt') desc);

create index if not exists full_exam_sessions_user_idx
  on full_exam_sessions ((data->>'userId'), (data->>'createdAt') desc);

create index if not exists ai_usage_logs_module_created_idx
  on ai_usage_logs ((data->>'module'), (data->>'createdAt') desc);

create index if not exists ai_usage_logs_request_hash_idx
  on ai_usage_logs ((data->>'requestHash'));

create index if not exists admin_audit_logs_actor_idx
  on admin_audit_logs ((data->>'actorUserId'), (data->>'createdAt') desc);
