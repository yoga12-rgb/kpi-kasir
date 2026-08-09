-- ============================================================
-- 0030_pending_profiles.sql
--
-- M2.1: Auth user baru tidak boleh langsung memperoleh akses aplikasi.
-- Profile hanya diaktifkan oleh flow setup pertama atau invite valid.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role, is_active)
  values (
    new.id,
    coalesce(new.email, 'pending-' || new.id::text || '@invalid.local'),
    coalesce(
      nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data->>'name'), ''),
      split_part(coalesce(new.email, new.id::text), '@', 1)
    ),
    'supervisor',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates a pending inactive profile. Trusted setup or invitation flows activate it.';
