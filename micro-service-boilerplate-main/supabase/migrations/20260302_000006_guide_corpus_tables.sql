-- Guide corpus tables for hierarchical IELTS guide CMS.
-- Uses doc-table schema to remain compatible with mongooseCompat persistence.

select public.create_doc_table('guide_pages');
select public.create_doc_table('guide_source_maps');
select public.create_doc_table('guide_qa_reports');
select public.create_doc_table('guide_import_jobs');
select public.create_doc_table('guide_taxonomy_nodes');

-- Guide page identity and discovery indexes.
create unique index if not exists guide_pages_canonical_path_unique_idx
  on guide_pages (lower(data->>'canonicalPath'));

create index if not exists guide_pages_state_updated_idx
  on guide_pages ((data->>'state'), (data->>'updatedAt'));

create index if not exists guide_pages_module_state_updated_idx
  on guide_pages ((data->>'module'), (data->>'state'), (data->>'updatedAt'));

create index if not exists guide_pages_content_class_state_updated_idx
  on guide_pages ((data->>'contentClass'), (data->>'state'), (data->>'updatedAt'));

create index if not exists guide_pages_legacy_slugs_gin_idx
  on guide_pages
  using gin ((data->'legacySlugs'));

create index if not exists guide_pages_published_at_idx
  on guide_pages ((data->>'publishedAt'));

-- Source mapping registry indexes.
create unique index if not exists guide_source_maps_source_url_unique_idx
  on guide_source_maps (lower(data->>'sourceUrl'));

create index if not exists guide_source_maps_status_wave_priority_idx
  on guide_source_maps ((data->>'status'), (data->>'publishWave'), (data->>'priority'));

create index if not exists guide_source_maps_module_updated_idx
  on guide_source_maps ((data->>'module'), (data->>'updatedAt'));

-- QA and job lifecycle indexes.
create index if not exists guide_qa_reports_page_created_idx
  on guide_qa_reports ((data->>'guidePageId'), (data->>'createdAt'));

create index if not exists guide_import_jobs_status_created_idx
  on guide_import_jobs ((data->>'status'), (data->>'createdAt'));

create unique index if not exists guide_taxonomy_nodes_key_unique_idx
  on guide_taxonomy_nodes (lower(data->>'key'));

create index if not exists guide_taxonomy_nodes_module_active_idx
  on guide_taxonomy_nodes ((data->>'module'), ((data->>'active')::boolean));
