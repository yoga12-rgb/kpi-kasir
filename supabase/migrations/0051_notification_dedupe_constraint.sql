-- M6.1: allow ON CONFLICT dedupe upsert using a plain unique constraint.

drop index if exists public.notification_dedupe_key_idx;

alter table public.notification
  add constraint notification_dedupe_key_unique unique (dedupe_key);
