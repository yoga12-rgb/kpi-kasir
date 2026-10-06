-- Supabase grants access to new public tables through default privileges.
-- Keep evidence metadata readable only to authenticated users subject to RLS;
-- all mutations must go through the service-role RPCs.
alter table public.mentoring_evidence enable row level security;

revoke all on table public.mentoring_evidence from PUBLIC, anon, authenticated;
grant select on table public.mentoring_evidence to authenticated;
grant all on table public.mentoring_evidence to service_role;
