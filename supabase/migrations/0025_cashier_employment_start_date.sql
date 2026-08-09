-- Track when each cashier started working.

alter table public.cashier
  add column employment_start_date date;

-- Existing cashiers use their creation date as the best available value.
update public.cashier
set employment_start_date = created_at::date
where employment_start_date is null;

alter table public.cashier
  alter column employment_start_date set default current_date,
  alter column employment_start_date set not null;
