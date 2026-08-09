-- 0052_notification_feed_index.sql
-- M6.2: support stable notification feed pagination.

create index if not exists notification_user_created_id_idx
  on public.notification (user_id, created_at desc, id desc);
