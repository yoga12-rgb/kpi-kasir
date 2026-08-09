-- Name-only invitations with registration tracking.

alter table public.invite
  add column invite_name text,
  add column accepted_user_id uuid references public.users (id) on delete set null;

-- Preserve existing invitations by deriving a display name from their email.
update public.invite
set invite_name = split_part(email, '@', 1)
where invite_name is null;

alter table public.invite
  alter column invite_name set not null,
  alter column email drop not null;

-- Link historical used invitations to the matching account when possible.
update public.invite as i
set accepted_user_id = u.id
from public.users as u
where i.used_at is not null
  and i.accepted_user_id is null
  and i.email is not null
  and lower(i.email) = lower(u.email);

create index invite_accepted_user_idx on public.invite (accepted_user_id);
