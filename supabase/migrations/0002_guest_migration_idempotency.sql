-- Enforce idempotent guest-to-account migration per authenticated user.
create unique index if not exists idx_cases_user_guest_local_id_unique
  on public.cases (user_id, guest_local_id)
  where guest_local_id is not null;
