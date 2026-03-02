-- Partner program document tables and indexes (influencer/institute unified model).

select public.create_doc_table('partners');
select public.create_doc_table('partner_members');
select public.create_doc_table('partner_codes');
select public.create_doc_table('partner_attribution_touches');
select public.create_doc_table('partner_conversions');
select public.create_doc_table('partner_targets');
select public.create_doc_table('partner_target_awards');
select public.create_doc_table('partner_payout_batches');
select public.create_doc_table('partner_payout_items');
select public.create_doc_table('processed_webhook_events');

create unique index if not exists partner_codes_code_unique_idx
  on partner_codes (upper(data->>'code'));

create unique index if not exists partner_members_partner_user_unique_idx
  on partner_members ((data->>'partnerId'), (data->>'userId'));

create unique index if not exists partner_conversions_user_unique_idx
  on partner_conversions ((data->>'userId'));

create unique index if not exists partner_conversions_invoice_unique_idx
  on partner_conversions ((data->>'stripeInvoiceId'));

create unique index if not exists partner_target_awards_unique_idx
  on partner_target_awards ((data->>'partnerTargetId'), (data->>'partnerId'), (data->>'periodStart'));

create unique index if not exists processed_webhook_events_event_unique_idx
  on processed_webhook_events ((data->>'provider'), (data->>'eventId'));

create index if not exists partner_attribution_touches_user_idx
  on partner_attribution_touches ((data->>'userId'), (data->>'touchedAt') desc);

create index if not exists partner_attribution_touches_partner_idx
  on partner_attribution_touches ((data->>'partnerId'), (data->>'touchedAt') desc);

create index if not exists partner_conversions_partner_idx
  on partner_conversions ((data->>'partnerId'), (data->>'convertedAt') desc);

create index if not exists partner_targets_partner_active_idx
  on partner_targets ((data->>'partnerId'), (data->>'isActive'));

create index if not exists partner_payout_items_partner_idx
  on partner_payout_items ((data->>'partnerId'), (data->>'createdAt') desc);

-- Ensure feature-flag exists for controlled rollout.
insert into feature_flags (id, data)
select encode(gen_random_bytes(12), 'hex'),
       jsonb_build_object(
         'key', 'partner_program',
         'description', 'Enables influencer/institute partner program surfaces',
         'enabled', false,
         'rolloutPercentage', 100
       )
where not exists (
  select 1 from feature_flags where lower(data->>'key') = 'partner_program'
);
