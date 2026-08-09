-- Defense-in-depth: app_setup tidak boleh membuat admin kedua ketika flag stale.

create or replace function public.reserve_setup(p_claim_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_setup public.app_setup;
  v_now timestamptz := now();
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  if p_claim_id is null then
    raise exception 'Claim setup tidak valid';
  end if;

  select * into v_setup
  from public.app_setup
  order by id
  limit 1
  for update;

  if v_setup.id is null then
    raise exception 'Konfigurasi setup tidak ditemukan';
  end if;

  if v_setup.admin_created then
    raise exception 'Setup sudah selesai';
  end if;

  if exists (
    select 1 from public.users
    where role = 'admin' and is_active = true
  ) then
    raise exception 'Setup sudah selesai';
  end if;

  if v_setup.setup_claim_id is not null
    and v_setup.setup_claimed_at > v_now - interval '10 minutes' then
    raise exception 'Setup sedang diproses';
  end if;

  if v_setup.setup_attempt_window_at is null
    or v_setup.setup_attempt_window_at <= v_now - interval '15 minutes' then
    v_setup.setup_attempt_count := 0;
    v_setup.setup_attempt_window_at := v_now;
  end if;

  if v_setup.setup_attempt_count >= 5 then
    raise exception 'Terlalu banyak percobaan setup, coba lagi nanti';
  end if;

  update public.app_setup
  set setup_claim_id = p_claim_id,
      setup_claimed_at = v_now,
      setup_attempt_count = v_setup.setup_attempt_count + 1,
      setup_attempt_window_at = v_setup.setup_attempt_window_at;

  return true;
end;
$$;

revoke all on function public.reserve_setup(uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_setup(uuid) to service_role;
