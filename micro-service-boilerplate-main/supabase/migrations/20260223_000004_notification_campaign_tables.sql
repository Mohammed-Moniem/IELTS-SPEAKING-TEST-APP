-- Notification campaign tables for multi-channel push (Expo mobile + FCM web).

select public.create_doc_table('notification_endpoints');
select public.create_doc_table('notification_campaigns');
select public.create_doc_table('notification_deliveries');

create unique index if not exists notification_endpoints_token_unique_idx
  on notification_endpoints ((data->>'token'));

create index if not exists notification_endpoints_user_channel_active_idx
  on notification_endpoints ((data->>'userId'), (data->>'channel'), ((data->>'isActive')::boolean));

create index if not exists notification_campaigns_status_scheduled_idx
  on notification_campaigns ((data->>'status'), (data->>'scheduledAt'));

create index if not exists notification_campaigns_created_by_idx
  on notification_campaigns ((data->>'createdByUserId'));

create index if not exists notification_deliveries_campaign_user_channel_idx
  on notification_deliveries ((data->>'campaignId'), (data->>'userId'), (data->>'channel'));

create index if not exists notification_deliveries_status_idx
  on notification_deliveries ((data->>'status'));
