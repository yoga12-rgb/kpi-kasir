-- UUID pada PostgreSQL menerima seluruh format hex UUID; jangan membatasi
-- nibble versi agar fixture/internal UUID tetap valid.

create or replace function public.create_mentoring_session_atomic(
  p_outlet_id uuid,
  p_conducted_by uuid,
  p_visited_date date,
  p_note_outlet text,
  p_cashier_notes jsonb
)
returns public.mentoring_session
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.users;
  v_outlet public.outlet;
  v_session public.mentoring_session;
  v_note jsonb;
  v_cashier_id uuid;
  v_notes jsonb := coalesce(p_cashier_notes, '[]'::jsonb);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  if p_outlet_id is null or p_conducted_by is null or p_visited_date is null
    or p_visited_date > current_date
    or char_length(coalesce(btrim(p_note_outlet), '')) > 2000
    or jsonb_typeof(v_notes) <> 'array'
    or jsonb_array_length(v_notes) > 100 then
    raise exception 'Data pendampingan tidak valid';
  end if;

  select * into v_actor
  from public.users
  where id = p_conducted_by
  for share;

  if v_actor.id is null or not v_actor.is_active then
    raise exception 'Actor pendampingan tidak aktif atau tidak ditemukan';
  end if;

  if v_actor.role <> 'admin'
    and not exists (
      select 1
      from public.role_permission
      where role = v_actor.role
        and permission = 'mentoring'
        and enabled = true
    ) then
    raise exception 'Actor tidak memiliki permission mentoring';
  end if;

  select o.* into v_outlet
  from public.outlet o
  join public.branch b on b.id = o.branch_id
  where o.id = p_outlet_id
    and o.is_active = true
    and b.is_active = true
  for share of o;

  if v_outlet.id is null then
    raise exception 'Outlet tidak aktif atau tidak ditemukan';
  end if;

  if v_actor.role <> 'admin'
    and not exists (
      select 1
      from public.user_branch
      where user_id = v_actor.id
        and branch_id = v_outlet.branch_id
    ) then
    raise exception 'Actor tidak memiliki akses ke cabang outlet';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_notes) as item
    group by item->>'cashierId'
    having count(*) > 1
  ) then
    raise exception 'Cashier note tidak boleh duplikat';
  end if;

  for v_note in select value from jsonb_array_elements(v_notes)
  loop
    if jsonb_typeof(v_note) <> 'object'
      or not (v_note ? 'cashierId')
      or not (v_note ? 'note')
      or not ((v_note->>'cashierId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      or char_length(btrim(coalesce(v_note->>'note', ''))) < 1
      or char_length(btrim(coalesce(v_note->>'note', ''))) > 2000 then
      raise exception 'Data catatan kasir tidak valid';
    end if;

    v_cashier_id := (v_note->>'cashierId')::uuid;
    if not exists (
      select 1
      from public.cashier
      where id = v_cashier_id
        and outlet_id = v_outlet.id
        and is_active = true
    ) then
      raise exception 'Kasir tidak aktif atau tidak sesuai outlet pendampingan';
    end if;
  end loop;

  insert into public.mentoring_session (outlet_id, conducted_by, visited_date, note_outlet)
  values (v_outlet.id, v_actor.id, p_visited_date, nullif(btrim(p_note_outlet), ''))
  returning * into v_session;

  for v_note in select value from jsonb_array_elements(v_notes)
  loop
    insert into public.mentoring_cashier_note (session_id, cashier_id, note)
    values (v_session.id, (v_note->>'cashierId')::uuid, btrim(v_note->>'note'));
  end loop;

  return v_session;
end;
$$;

revoke all on function public.create_mentoring_session_atomic(uuid, uuid, date, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_mentoring_session_atomic(uuid, uuid, date, text, jsonb) to service_role;
