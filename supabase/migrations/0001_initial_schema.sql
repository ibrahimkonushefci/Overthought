-- Overthought - Supabase schema (v1 / expansion-ready)
-- Notes:
-- - iOS-first app
-- - guest mode is local-first; guest cases are not stored server-side until migration
-- - authenticated users store cases in Supabase
-- - designed to stay simple in v1 but expand cleanly later

create extension if not exists pgcrypto;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.case_category AS ENUM ('romance', 'friendship', 'social', 'general');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.outcome_status AS ENUM ('unknown', 'right', 'wrong', 'unclear');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.entitlement_status AS ENUM ('free', 'premium', 'grace_period', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.entitlement_source AS ENUM ('none', 'revenuecat', 'manual_debug');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.verdict_label AS ENUM (
    'barely_delusional',
    'slight_reach',
    'mild_delusion',
    'dangerous_overthinking',
    'full_clown_territory'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.auth_provider AS ENUM ('apple', 'google', 'email', 'unknown');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  auth_provider public.auth_provider not null default 'unknown',
  onboarding_completed boolean not null default false,
  is_guest boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

-- User preferences
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  notifications_enabled boolean not null default false,
  push_token text,
  preferred_tone text,
  preferred_default_category public.case_category,
  share_watermark_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Premium state scaffold
create table if not exists public.premium_states (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  entitlement_status public.entitlement_status not null default 'free',
  source public.entitlement_source not null default 'none',
  entitlement_id text,
  product_id text,
  expires_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

-- Cases
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  guest_local_id text,
  title text,
  category public.case_category not null,
  input_text text not null,
  verdict_label public.verdict_label not null,
  delusion_score integer not null check (delusion_score >= 0 and delusion_score <= 100),
  explanation_text text not null,
  next_move_text text not null,
  outcome_status public.outcome_status not null default 'unknown',
  latest_verdict_version integer not null default 1,
  last_analyzed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  deleted_at timestamptz
);

-- Lightweight updates only (not chat)
create table if not exists public.case_updates (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  update_text text not null,
  verdict_label public.verdict_label,
  delusion_score integer check (delusion_score is null or (delusion_score >= 0 and delusion_score <= 100)),
  explanation_text text,
  next_move_text text,
  verdict_version integer,
  created_at timestamptz not null default timezone('utc', now())
);

-- Optional event log for product debugging / support
create table if not exists public.analytics_debug_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

-- Helpful indexes
create index if not exists idx_cases_user_updated_at on public.cases (user_id, updated_at desc);
create index if not exists idx_cases_user_created_at on public.cases (user_id, created_at desc);
create index if not exists idx_cases_category on public.cases (category);
create index if not exists idx_cases_archived on public.cases (archived_at);
create index if not exists idx_case_updates_case_created_at on public.case_updates (case_id, created_at asc);
create index if not exists idx_analytics_debug_events_user_created_at on public.analytics_debug_events (user_id, created_at desc);

-- Utility: updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Utility: auto-create profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider_value text;
  provider_enum public.auth_provider := 'unknown';
begin
  provider_value := coalesce(new.raw_app_meta_data->>'provider', new.raw_user_meta_data->>'provider', 'unknown');

  if provider_value = 'apple' then
    provider_enum := 'apple';
  elsif provider_value = 'google' then
    provider_enum := 'google';
  elsif provider_value = 'email' then
    provider_enum := 'email';
  else
    provider_enum := 'unknown';
  end if;

  insert into public.profiles (id, email, display_name, auth_provider, onboarding_completed, is_guest)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1), null),
    provider_enum,
    false,
    false
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.premium_states (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Triggers
DROP TRIGGER IF EXISTS on_auth_user_created_delusion_tracker ON auth.users;
create trigger on_auth_user_created_delusion_tracker
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

DROP TRIGGER IF EXISTS trg_profiles_set_updated_at ON public.profiles;
create trigger trg_profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

DROP TRIGGER IF EXISTS trg_user_preferences_set_updated_at ON public.user_preferences;
create trigger trg_user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute procedure public.set_updated_at();

DROP TRIGGER IF EXISTS trg_premium_states_set_updated_at ON public.premium_states;
create trigger trg_premium_states_set_updated_at
  before update on public.premium_states
  for each row execute procedure public.set_updated_at();

DROP TRIGGER IF EXISTS trg_cases_set_updated_at ON public.cases;
create trigger trg_cases_set_updated_at
  before update on public.cases
  for each row execute procedure public.set_updated_at();

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.premium_states enable row level security;
alter table public.cases enable row level security;
alter table public.case_updates enable row level security;
alter table public.analytics_debug_events enable row level security;

-- Profiles policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- User preferences policies
DROP POLICY IF EXISTS "user_preferences_manage_own" ON public.user_preferences;
create policy "user_preferences_manage_own"
  on public.user_preferences for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Premium state policies (read own, update via service role / webhook)
DROP POLICY IF EXISTS "premium_states_select_own" ON public.premium_states;
create policy "premium_states_select_own"
  on public.premium_states for select
  to authenticated
  using (auth.uid() = user_id);

-- Cases policies
DROP POLICY IF EXISTS "cases_manage_own" ON public.cases;
create policy "cases_manage_own"
  on public.cases for all
  to authenticated
  using (auth.uid() = user_id and deleted_at is null)
  with check (auth.uid() = user_id);

-- Case updates policies
DROP POLICY IF EXISTS "case_updates_manage_own" ON public.case_updates;
create policy "case_updates_manage_own"
  on public.case_updates for all
  to authenticated
  using (
    exists (
      select 1
      from public.cases c
      where c.id = case_updates.case_id
        and c.user_id = auth.uid()
        and c.deleted_at is null
    )
  )
  with check (
    exists (
      select 1
      from public.cases c
      where c.id = case_updates.case_id
        and c.user_id = auth.uid()
        and c.deleted_at is null
    )
  );

-- Analytics debug events: read/write own only; can be removed entirely if not used
DROP POLICY IF EXISTS "analytics_debug_events_manage_own" ON public.analytics_debug_events;
create policy "analytics_debug_events_manage_own"
  on public.analytics_debug_events for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Convenience view for case detail + update count
create or replace view public.case_summaries as
select
  c.id,
  c.user_id,
  c.title,
  c.category,
  c.verdict_label,
  c.delusion_score,
  c.outcome_status,
  c.latest_verdict_version,
  c.created_at,
  c.updated_at,
  c.archived_at,
  (
    select count(*)::int
    from public.case_updates cu
    where cu.case_id = c.id
  ) as update_count
from public.cases c
where c.deleted_at is null;

-- Note for Codex:
-- Guest data should live in local storage / on-device database in v1.
-- On sign-up or sign-in, migrate local guest cases into public.cases and public.case_updates via app-side migration logic
-- or a dedicated Edge Function if desired.
