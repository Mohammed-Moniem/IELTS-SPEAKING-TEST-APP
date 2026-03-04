-- Reading v2 performance indexes for bank selection and attempt retrieval.

create index if not exists reading_tests_track_active_autopublished_schema_idx
  on reading_tests ((data->>'track'), (data->>'active'), (data->>'autoPublished'), (data->>'schemaVersion'));

create index if not exists reading_tests_track_updated_v2_idx
  on reading_tests ((data->>'track'), (data->>'schemaVersion'), updated_at desc);

create index if not exists reading_attempts_user_track_created_idx
  on reading_attempts ((data->>'userId'), (data->>'track'), (data->>'createdAt') desc);

create index if not exists reading_attempts_test_created_idx
  on reading_attempts ((data->>'testId'), (data->>'createdAt') desc);

create index if not exists reading_attempts_status_feedback_v2_idx
  on reading_attempts ((data->>'status'), (data->>'feedbackVersion'), (data->>'deepFeedbackReady'));
