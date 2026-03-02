-- Growth layer tables: blog pipeline, learner library, and advertising/affiliate monetization.

select public.create_doc_table('blog_posts');
select public.create_doc_table('blog_jobs');
select public.create_doc_table('blog_topic_clusters');
select public.create_doc_table('blog_qa_reports');
select public.create_doc_table('lexicon_entries');
select public.create_doc_table('collocation_entries');
select public.create_doc_table('resource_recommendations');
select public.create_doc_table('user_library_decks');
select public.create_doc_table('deck_review_events');
select public.create_doc_table('ad_packages');
select public.create_doc_table('advertiser_accounts');
select public.create_doc_table('ad_campaigns');
select public.create_doc_table('ad_creatives');
select public.create_doc_table('ad_placement_events');

create unique index if not exists blog_posts_slug_unique_idx
  on blog_posts (lower(data->>'slug'));

create index if not exists blog_posts_state_cluster_updated_idx
  on blog_posts ((data->>'state'), (data->>'cluster'), (data->>'updatedAt'));

create index if not exists blog_jobs_status_created_idx
  on blog_jobs ((data->>'status'), (data->>'createdAt'));

create unique index if not exists blog_topic_clusters_key_unique_idx
  on blog_topic_clusters (lower(data->>'key'));

create index if not exists blog_qa_reports_post_created_idx
  on blog_qa_reports ((data->>'postId'), (data->>'createdAt'));

create unique index if not exists lexicon_entries_lemma_module_unique_idx
  on lexicon_entries (lower(data->>'lemma'), (data->>'module'));

create unique index if not exists collocation_entries_phrase_module_unique_idx
  on collocation_entries (lower(data->>'phrase'), (data->>'module'));

create index if not exists resource_recommendations_type_module_active_idx
  on resource_recommendations ((data->>'type'), (data->>'module'), ((data->>'active')::boolean));

create index if not exists user_library_decks_user_type_created_idx
  on user_library_decks ((data->>'userId'), (data->>'entryType'), (data->>'createdAt'));

create index if not exists deck_review_events_user_next_review_idx
  on deck_review_events ((data->>'userId'), (data->>'nextReviewAt'));

create unique index if not exists ad_packages_key_unique_idx
  on ad_packages (lower(data->>'key'));

create unique index if not exists advertiser_accounts_owner_unique_idx
  on advertiser_accounts ((data->>'ownerUserId'));

create index if not exists ad_campaigns_status_active_window_idx
  on ad_campaigns ((data->>'status'), (data->>'startsAt'), (data->>'endsAt'));

create index if not exists ad_campaigns_advertiser_status_idx
  on ad_campaigns ((data->>'advertiserAccountId'), (data->>'status'));

create index if not exists ad_creatives_campaign_status_idx
  on ad_creatives ((data->>'campaignId'), (data->>'status'));

create index if not exists ad_placement_events_campaign_action_created_idx
  on ad_placement_events ((data->>'campaignId'), (data->>'action'), (data->>'createdAt'));

-- Seed topic clusters for hybrid blog governance.
insert into blog_topic_clusters (id, data, created_at, updated_at)
values
  (
    'b10000000000000000000001',
    jsonb_build_object(
      '_id', 'b10000000000000000000001',
      'key', 'speaking-strategy',
      'name', 'IELTS Speaking Strategy',
      'description', 'Part-based speaking tactics and scoring improvements.',
      'priority', 10,
      'active', true,
      'refreshCadenceDays', 21,
      'createdAt', now(),
      'updatedAt', now()
    ),
    now(),
    now()
  ),
  (
    'b10000000000000000000002',
    jsonb_build_object(
      '_id', 'b10000000000000000000002',
      'key', 'writing-band-improvement',
      'name', 'IELTS Writing Band Improvement',
      'description', 'Task response, coherence, lexical resource and grammar improvements.',
      'priority', 12,
      'active', true,
      'refreshCadenceDays', 21,
      'createdAt', now(),
      'updatedAt', now()
    ),
    now(),
    now()
  ),
  (
    'b10000000000000000000003',
    jsonb_build_object(
      '_id', 'b10000000000000000000003',
      'key', 'reading-listening-accuracy',
      'name', 'Reading and Listening Accuracy',
      'description', 'Objective test tactics, pacing and error reduction.',
      'priority', 15,
      'active', true,
      'refreshCadenceDays', 30,
      'createdAt', now(),
      'updatedAt', now()
    ),
    now(),
    now()
  )
on conflict (id) do nothing;

-- Seed curated vocabulary/collocation/resource entries for growth_library_v1 launch.
insert into lexicon_entries (id, data, created_at, updated_at)
values
  (
    'l10000000000000000000001',
    jsonb_build_object(
      '_id', 'l10000000000000000000001',
      'lemma', 'sustainable',
      'definition', 'Able to continue over a long period without harming resources.',
      'cefr', 'B2',
      'module', 'writing',
      'bandTargetMin', 6,
      'bandTargetMax', 8,
      'topic', 'environment',
      'synonyms', jsonb_build_array('viable', 'long-term'),
      'examples', jsonb_build_array('A sustainable transport policy reduces congestion and pollution.'),
      'frequencyRank', 1800,
      'sourceType', 'curated',
      'qualityScore', 0.92,
      'active', true,
      'createdAt', now(),
      'updatedAt', now()
    ),
    now(),
    now()
  ),
  (
    'l10000000000000000000002',
    jsonb_build_object(
      '_id', 'l10000000000000000000002',
      'lemma', 'mitigate',
      'definition', 'To make something less severe or harmful.',
      'cefr', 'C1',
      'module', 'speaking',
      'bandTargetMin', 7,
      'bandTargetMax', 9,
      'topic', 'policy',
      'synonyms', jsonb_build_array('alleviate', 'reduce'),
      'examples', jsonb_build_array('Governments should mitigate the negative impact of heavy traffic.'),
      'frequencyRank', 2200,
      'sourceType', 'curated',
      'qualityScore', 0.94,
      'active', true,
      'createdAt', now(),
      'updatedAt', now()
    ),
    now(),
    now()
  )
on conflict (id) do nothing;

insert into collocation_entries (id, data, created_at, updated_at)
values
  (
    'c10000000000000000000001',
    jsonb_build_object(
      '_id', 'c10000000000000000000001',
      'phrase', 'pose a challenge',
      'meaning', 'To create a difficulty that must be addressed.',
      'module', 'writing',
      'cefr', 'B2',
      'topic', 'education',
      'bandTargetMin', 6,
      'bandTargetMax', 8,
      'examples', jsonb_build_array('Online-only classes can pose a challenge for students lacking stable internet.'),
      'alternatives', jsonb_build_array('create difficulties', 'be problematic'),
      'frequencyRank', 3100,
      'sourceType', 'curated',
      'qualityScore', 0.91,
      'active', true,
      'createdAt', now(),
      'updatedAt', now()
    ),
    now(),
    now()
  ),
  (
    'c10000000000000000000002',
    jsonb_build_object(
      '_id', 'c10000000000000000000002',
      'phrase', 'reach a consensus',
      'meaning', 'To arrive at a common agreement.',
      'module', 'speaking',
      'cefr', 'C1',
      'topic', 'society',
      'bandTargetMin', 7,
      'bandTargetMax', 9,
      'examples', jsonb_build_array('It is difficult for large communities to reach a consensus on transport policies.'),
      'alternatives', jsonb_build_array('agree collectively', 'find common ground'),
      'frequencyRank', 3500,
      'sourceType', 'curated',
      'qualityScore', 0.93,
      'active', true,
      'createdAt', now(),
      'updatedAt', now()
    ),
    now(),
    now()
  )
on conflict (id) do nothing;

insert into resource_recommendations (id, data, created_at, updated_at)
values
  (
    'r10000000000000000000001',
    jsonb_build_object(
      '_id', 'r10000000000000000000001',
      'title', 'The Official Cambridge Guide to IELTS',
      'type', 'book',
      'provider', 'Cambridge University Press',
      'url', 'https://www.cambridge.org/',
      'description', 'Comprehensive practice and strategy guide for all IELTS modules.',
      'module', 'all',
      'topic', 'exam-strategy',
      'bandTargetMin', 5,
      'bandTargetMax', 9,
      'cefr', 'B1',
      'difficulty', 'intermediate',
      'sponsored', false,
      'sourceType', 'curated',
      'qualityScore', 0.96,
      'active', true,
      'createdAt', now(),
      'updatedAt', now()
    ),
    now(),
    now()
  ),
  (
    'r10000000000000000000002',
    jsonb_build_object(
      '_id', 'r10000000000000000000002',
      'title', 'IELTS Liz',
      'type', 'channel',
      'provider', 'IELTS Liz',
      'url', 'https://ieltsliz.com/',
      'description', 'Trusted IELTS preparation lessons, tips and practice resources.',
      'module', 'all',
      'topic', 'exam-strategy',
      'bandTargetMin', 5,
      'bandTargetMax', 9,
      'cefr', 'B1',
      'difficulty', 'beginner',
      'sponsored', false,
      'sourceType', 'curated',
      'qualityScore', 0.95,
      'active', true,
      'createdAt', now(),
      'updatedAt', now()
    ),
    now(),
    now()
  )
on conflict (id) do nothing;

-- Seed advertiser packages (stripePriceId is optional and can be configured later).
insert into ad_packages (id, data, created_at, updated_at)
values
  (
    'a10000000000000000000001',
    jsonb_build_object(
      '_id', 'a10000000000000000000001',
      'key', 'coach_starter',
      'name', 'Coach Starter',
      'description', 'Starter package for IELTS coaches targeting learner discovery slots.',
      'placementType', 'module_panel',
      'billingType', 'monthly_subscription',
      'currency', 'USD',
      'priceAmount', 149,
      'features', jsonb_build_array('Module side panel placement', 'Basic performance report'),
      'isActive', true,
      'createdAt', now(),
      'updatedAt', now()
    ),
    now(),
    now()
  ),
  (
    'a10000000000000000000002',
    jsonb_build_object(
      '_id', 'a10000000000000000000002',
      'key', 'institute_growth',
      'name', 'Institute Growth',
      'description', 'Multi-placement package for institutes and training providers.',
      'placementType', 'homepage_sponsor',
      'billingType', 'monthly_subscription',
      'currency', 'USD',
      'priceAmount', 499,
      'features', jsonb_build_array('Homepage sponsor card', 'Blog sponsored block', 'Campaign analytics export'),
      'isActive', true,
      'createdAt', now(),
      'updatedAt', now()
    ),
    now(),
    now()
  ),
  (
    'a10000000000000000000003',
    jsonb_build_object(
      '_id', 'a10000000000000000000003',
      'key', 'premium_spotlight',
      'name', 'Premium Spotlight',
      'description', 'High-visibility package with premium placements and reporting.',
      'placementType', 'partner_spotlight',
      'billingType', 'monthly_subscription',
      'currency', 'USD',
      'priceAmount', 999,
      'features', jsonb_build_array('Partner spotlight slot', 'Newsletter slot', 'Priority campaign approval'),
      'isActive', true,
      'createdAt', now(),
      'updatedAt', now()
    ),
    now(),
    now()
  )
on conflict (id) do nothing;
