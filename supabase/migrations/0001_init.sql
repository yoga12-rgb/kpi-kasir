-- ============================================================
-- 0001_init.sql — Skema awal Aplikasi KPI & Ranking Kasir
-- Sesuai technical-spec.md §3
-- ============================================================

-- ---------- ENUMS ----------
create type public.user_role as enum ('admin', 'manager', 'supervisor');
create type public.detail_type as enum ('scale', 'deduction');
create type public.period_status as enum ('open', 'closed');
create type public.notification_type as enum ('reminder_unassessed', 'low_score_alert', 'system');

-- ---------- EXTENSIONS ----------
create extension if not exists "pgcrypto";

-- ---------- APP SETUP ----------
create table public.app_setup (
  id uuid primary key default gen_random_uuid(),
  admin_created boolean not null default false,
  completed_at timestamptz
);

-- Pastikan hanya satu baris setup
insert into public.app_setup (id) values ('00000000-0000-0000-0000-000000000001');

-- ---------- USERS (profil, terhubung ke auth.users) ----------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.user_role not null default 'supervisor',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- BRANCH (Cabang) ----------
create table public.branch (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- OUTLET ----------
create table public.outlet (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branch (id),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index outlet_branch_id_idx on public.outlet (branch_id);

-- ---------- CASHIER (Kasir) ----------
create table public.cashier (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  outlet_id uuid not null references public.outlet (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cashier_outlet_id_idx on public.cashier (outlet_id);

-- ---------- CASHIER OUTLET HISTORY ----------
create table public.cashier_outlet_history (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null references public.cashier (id) on delete cascade,
  outlet_id uuid not null references public.outlet (id),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index cashier_outlet_history_cashier_idx on public.cashier_outlet_history (cashier_id);

-- ---------- USER BRANCH (penugasan) ----------
create table public.user_branch (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  branch_id uuid not null references public.branch (id),
  assigned_at timestamptz not null default now(),
  unique (user_id, branch_id)
);

create index user_branch_branch_idx on public.user_branch (branch_id);

-- ---------- PERIOD ----------
create table public.period (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  start_date date not null,
  end_date date not null,
  status public.period_status not null default 'open',
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ---------- CATEGORY ----------
create table public.category (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  weight numeric(5,2) not null default 0 check (weight >= 0 and weight <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- CATEGORY WEIGHT HISTORY ----------
create table public.category_weight_history (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.category (id) on delete cascade,
  period_id uuid not null references public.period (id) on delete cascade,
  weight numeric(5,2) not null check (weight >= 0 and weight <= 100),
  unique (category_id, period_id)
);

-- ---------- DETAIL ----------
create table public.detail (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.category (id) on delete cascade,
  name text not null,
  type public.detail_type not null,
  scale_max numeric check (scale_max is null or scale_max > 0),
  deduction_points numeric check (deduction_points is null or deduction_points > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (type = 'scale' and scale_max is not null and deduction_points is null) or
    (type = 'deduction' and deduction_points is not null and scale_max is null)
  )
);

create index detail_category_idx on public.detail (category_id);

-- ---------- DETAIL CONFIG HISTORY ----------
create table public.detail_config_history (
  id uuid primary key default gen_random_uuid(),
  detail_id uuid not null references public.detail (id) on delete cascade,
  period_id uuid not null references public.period (id) on delete cascade,
  scale_max numeric,
  deduction_points numeric,
  unique (detail_id, period_id)
);

-- ---------- ASSESSMENT ----------
create table public.assessment (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.period (id) on delete cascade,
  cashier_id uuid not null references public.cashier (id) on delete cascade,
  detail_id uuid not null references public.detail (id) on delete cascade,
  scale_value numeric,
  normalized_score numeric(5,2) not null default 0 check (normalized_score >= 0 and normalized_score <= 100),
  assessed_by uuid not null references public.users (id),
  assessed_at timestamptz not null default now(),
  unique (period_id, cashier_id, detail_id)
);

create index assessment_period_cashier_idx on public.assessment (period_id, cashier_id);
create index assessment_detail_idx on public.assessment (detail_id);

-- ---------- DEDUCTION EVENT ----------
create table public.deduction_event (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessment (id) on delete cascade,
  note text,
  points numeric not null check (points > 0),
  occurred_at timestamptz not null default now(),
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now()
);

create index deduction_event_assessment_idx on public.deduction_event (assessment_id);

-- ---------- CASHIER PERIOD SCORE ----------
create table public.cashier_period_score (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.period (id) on delete cascade,
  cashier_id uuid not null references public.cashier (id) on delete cascade,
  total_score numeric(5,2) not null default 0 check (total_score >= 0 and total_score <= 100),
  category_scores jsonb not null default '{}'::jsonb,
  is_locked boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (period_id, cashier_id)
);

create index cashier_period_score_period_idx on public.cashier_period_score (period_id);

-- ---------- LEADERBOARD ENTRY ----------
create table public.leaderboard_entry (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.period (id) on delete cascade,
  cashier_id uuid not null references public.cashier (id) on delete cascade,
  outlet_id uuid not null references public.outlet (id),
  branch_id uuid not null references public.branch (id),
  total_score numeric(5,2) not null check (total_score >= 0 and total_score <= 100),
  category_scores jsonb not null default '{}'::jsonb,
  rank_outlet integer,
  rank_branch integer,
  rank_global integer,
  unique (period_id, cashier_id)
);

create index leaderboard_entry_period_idx on public.leaderboard_entry (period_id);
create index leaderboard_entry_branch_idx on public.leaderboard_entry (branch_id);
create index leaderboard_entry_outlet_idx on public.leaderboard_entry (outlet_id);

-- ---------- CASHIER CUMULATIVE SCORE ----------
create table public.cashier_cumulative_score (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null unique references public.cashier (id) on delete cascade,
  cumulative_score numeric(10,2) not null default 0,
  periods_count integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- MENTORING SESSION ----------
create table public.mentoring_session (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlet (id) on delete cascade,
  conducted_by uuid not null references public.users (id),
  visited_date date not null,
  note_outlet text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mentoring_session_outlet_idx on public.mentoring_session (outlet_id);

-- ---------- MENTORING CASHIER NOTE ----------
create table public.mentoring_cashier_note (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mentoring_session (id) on delete cascade,
  cashier_id uuid not null references public.cashier (id) on delete cascade,
  note text not null,
  unique (session_id, cashier_id)
);

create index mentoring_cashier_note_cashier_idx on public.mentoring_cashier_note (cashier_id);

-- ---------- INVITE ----------
create table public.invite (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.user_role not null,
  token text not null unique,
  branch_ids uuid[] not null default '{}',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now()
);

create index invite_token_idx on public.invite (token);

-- ---------- NOTIFICATION ----------
create table public.notification (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type public.notification_type not null default 'system',
  title text not null,
  body text not null default '',
  payload jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notification_user_idx on public.notification (user_id, is_read);

-- ---------- PERIOD LOG ----------
create table public.period_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  period_id uuid references public.period (id),
  performed_by uuid references public.users (id),
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ---------- TRIGGER: updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

create trigger branch_updated_at before update on public.branch
  for each row execute function public.set_updated_at();

create trigger outlet_updated_at before update on public.outlet
  for each row execute function public.set_updated_at();

create trigger cashier_updated_at before update on public.cashier
  for each row execute function public.set_updated_at();

create trigger category_updated_at before update on public.category
  for each row execute function public.set_updated_at();

create trigger detail_updated_at before update on public.detail
  for each row execute function public.set_updated_at();

create trigger mentoring_session_updated_at before update on public.mentoring_session
  for each row execute function public.set_updated_at();