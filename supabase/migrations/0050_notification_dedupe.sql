-- ============================================================
-- 0050_notification_dedupe.sql
--
-- M6.1: make scheduled notification delivery idempotent.
-- ============================================================

alter table public.notification
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists period_id uuid references public.period (id) on delete cascade,
  add column if not exists dedupe_key text;

create unique index if not exists notification_dedupe_key_idx
  on public.notification (dedupe_key)
  where dedupe_key is not null;

create index if not exists notification_period_entity_idx
  on public.notification (period_id, entity_type, entity_id);
