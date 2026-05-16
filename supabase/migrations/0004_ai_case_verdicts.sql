-- Canonical AI verdict storage and abuse-resistant usage accounting.
-- Notes:
-- - The existing cases table keeps the local deterministic verdict untouched.
-- - Authenticated AI verdicts are stored separately from cases.
-- - Guest AI verdicts are cached separately and are not linked during guest-to-account migration yet.
-- - Usage events intentionally store fingerprints and metadata, not raw case text.

DO $$ BEGIN
  CREATE TYPE public.ai_case_verdict_access_tier AS ENUM ('guest', 'free', 'premium');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.ai_case_verdict_access_tier ADD VALUE IF NOT EXISTS 'guest';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_case_verdict_usage_status AS ENUM ('reserved', 'succeeded', 'failed', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

create table if not exists public.ai_case_verdicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  target_fingerprint text not null,
  category public.case_category not null,
  local_verdict_label public.verdict_label not null,
  local_delusion_score integer not null check (local_delusion_score >= 0 and local_delusion_score <= 100),
  local_explanation_text text not null,
  local_next_move_text text not null,
  local_verdict_version integer not null,
  verdict_label public.verdict_label not null,
  delusion_score integer not null check (delusion_score >= 0 and delusion_score <= 100),
  explanation_text text not null,
  next_move_text text not null,
  verdict_version integer not null,
  model_provider text not null,
  model_name text not null,
  model_version text,
  prompt_version integer not null,
  response_schema_version integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_case_verdicts_target_fingerprint_not_blank check (length(trim(target_fingerprint)) > 0),
  constraint ai_case_verdicts_local_explanation_not_blank check (length(trim(local_explanation_text)) > 0),
  constraint ai_case_verdicts_local_next_move_not_blank check (length(trim(local_next_move_text)) > 0),
  constraint ai_case_verdicts_explanation_not_blank check (length(trim(explanation_text)) > 0),
  constraint ai_case_verdicts_next_move_not_blank check (length(trim(next_move_text)) > 0),
  constraint ai_case_verdicts_model_provider_not_blank check (length(trim(model_provider)) > 0),
  constraint ai_case_verdicts_model_name_not_blank check (length(trim(model_name)) > 0)
);

create table if not exists public.ai_guest_case_verdicts (
  id uuid primary key default gen_random_uuid(),
  guest_key_hash text not null,
  target_fingerprint text not null,
  category public.case_category not null,
  local_verdict_label public.verdict_label not null,
  local_delusion_score integer not null check (local_delusion_score >= 0 and local_delusion_score <= 100),
  local_explanation_text text not null,
  local_next_move_text text not null,
  local_verdict_version integer not null,
  verdict_label public.verdict_label not null,
  delusion_score integer not null check (delusion_score >= 0 and delusion_score <= 100),
  explanation_text text not null,
  next_move_text text not null,
  verdict_version integer not null,
  model_provider text not null,
  model_name text not null,
  model_version text,
  prompt_version integer not null,
  response_schema_version integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_guest_case_verdicts_guest_hash_not_blank check (length(trim(guest_key_hash)) > 0),
  constraint ai_guest_case_verdicts_target_fingerprint_not_blank check (length(trim(target_fingerprint)) > 0),
  constraint ai_guest_case_verdicts_local_explanation_not_blank check (length(trim(local_explanation_text)) > 0),
  constraint ai_guest_case_verdicts_local_next_move_not_blank check (length(trim(local_next_move_text)) > 0),
  constraint ai_guest_case_verdicts_explanation_not_blank check (length(trim(explanation_text)) > 0),
  constraint ai_guest_case_verdicts_next_move_not_blank check (length(trim(next_move_text)) > 0),
  constraint ai_guest_case_verdicts_model_provider_not_blank check (length(trim(model_provider)) > 0),
  constraint ai_guest_case_verdicts_model_name_not_blank check (length(trim(model_name)) > 0)
);

create table if not exists public.ai_case_verdict_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  guest_key_hash text,
  ip_hash text,
  access_tier public.ai_case_verdict_access_tier not null default 'free',
  target_fingerprint text not null,
  quota_bucket date not null default (timezone('utc', now()))::date,
  status public.ai_case_verdict_usage_status not null default 'reserved',
  ai_case_verdict_id uuid references public.ai_case_verdicts(id) on delete cascade,
  ai_guest_case_verdict_id uuid references public.ai_guest_case_verdicts(id) on delete cascade,
  failure_code text,
  created_at timestamptz not null default timezone('utc', now()),
  finalized_at timestamptz,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '10 minutes'),
  constraint ai_case_verdict_usage_identity check (
    (
      access_tier::text in ('free', 'premium')
      and user_id is not null
      and guest_key_hash is null
    )
    or
    (
      access_tier::text = 'guest'
      and user_id is null
      and guest_key_hash is not null
    )
  ),
  constraint ai_case_verdict_usage_guest_hash_not_blank check (
    guest_key_hash is null or length(trim(guest_key_hash)) > 0
  ),
  constraint ai_case_verdict_usage_ip_hash_not_blank check (
    ip_hash is null or length(trim(ip_hash)) > 0
  ),
  constraint ai_case_verdict_usage_target_fingerprint_not_blank check (length(trim(target_fingerprint)) > 0),
  constraint ai_case_verdict_usage_success_shape check (
    (
      status = 'succeeded'
      and finalized_at is not null
      and failure_code is null
      and (
        (
          access_tier::text in ('free', 'premium')
          and ai_case_verdict_id is not null
          and ai_guest_case_verdict_id is null
        )
        or
        (
          access_tier::text = 'guest'
          and ai_case_verdict_id is null
          and ai_guest_case_verdict_id is not null
        )
      )
    )
    or
    (
      status = 'reserved'
      and ai_case_verdict_id is null
      and ai_guest_case_verdict_id is null
      and failure_code is null
      and finalized_at is null
    )
    or
    (
      status in ('failed', 'expired')
      and ai_case_verdict_id is null
      and ai_guest_case_verdict_id is null
      and failure_code is not null
      and finalized_at is not null
    )
  )
);

create unique index if not exists idx_ai_case_verdicts_cache_key
  on public.ai_case_verdicts (
    user_id,
    case_id,
    target_fingerprint,
    model_provider,
    model_name,
    prompt_version,
    response_schema_version
  );

create unique index if not exists idx_ai_guest_case_verdicts_cache_key
  on public.ai_guest_case_verdicts (
    guest_key_hash,
    target_fingerprint,
    model_provider,
    model_name,
    prompt_version,
    response_schema_version
  );

create index if not exists idx_ai_case_verdicts_user_created_at
  on public.ai_case_verdicts (user_id, created_at desc);

create index if not exists idx_ai_case_verdicts_case_id
  on public.ai_case_verdicts (case_id);

create index if not exists idx_ai_guest_case_verdicts_guest_created_at
  on public.ai_guest_case_verdicts (guest_key_hash, created_at desc);

create index if not exists idx_ai_case_verdict_usage_user_bucket_status
  on public.ai_case_verdict_usage_events (user_id, quota_bucket, status)
  where user_id is not null;

create index if not exists idx_ai_case_verdict_usage_guest_status
  on public.ai_case_verdict_usage_events (guest_key_hash, status)
  where guest_key_hash is not null;

create index if not exists idx_ai_case_verdict_usage_guest_bucket_status
  on public.ai_case_verdict_usage_events (guest_key_hash, quota_bucket, status)
  where guest_key_hash is not null;

create index if not exists idx_ai_case_verdict_usage_ip_bucket_status
  on public.ai_case_verdict_usage_events (ip_hash, quota_bucket, status)
  where ip_hash is not null;

create index if not exists idx_ai_case_verdict_usage_global_bucket_status
  on public.ai_case_verdict_usage_events (quota_bucket, status);

create index if not exists idx_ai_case_verdict_usage_reserved_expires
  on public.ai_case_verdict_usage_events (expires_at)
  where status = 'reserved';

DROP TRIGGER IF EXISTS trg_ai_case_verdicts_set_updated_at ON public.ai_case_verdicts;
create trigger trg_ai_case_verdicts_set_updated_at
  before update on public.ai_case_verdicts
  for each row execute procedure public.set_updated_at();

DROP TRIGGER IF EXISTS trg_ai_guest_case_verdicts_set_updated_at ON public.ai_guest_case_verdicts;
create trigger trg_ai_guest_case_verdicts_set_updated_at
  before update on public.ai_guest_case_verdicts
  for each row execute procedure public.set_updated_at();

alter table public.ai_case_verdicts enable row level security;
alter table public.ai_guest_case_verdicts enable row level security;
alter table public.ai_case_verdict_usage_events enable row level security;

-- Users may read their own AI verdicts only when the parent case is active and owned.
-- Writes are intentionally server-only through Edge Functions using the service role.
DROP POLICY IF EXISTS "ai_case_verdicts_select_own" ON public.ai_case_verdicts;
create policy "ai_case_verdicts_select_own"
  on public.ai_case_verdicts for select
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.cases c
      where c.id = ai_case_verdicts.case_id
        and c.user_id = auth.uid()
        and c.archived_at is null
        and c.deleted_at is null
    )
  );

-- Guest cache and usage events remain server-managed quota/accounting data.
-- No client policies are created in v1.

create or replace function public.reserve_ai_case_verdict_usage(
  p_user_id uuid,
  p_guest_key_hash text,
  p_ip_hash text,
  p_access_tier public.ai_case_verdict_access_tier,
  p_target_fingerprint text,
  p_quota_bucket date,
  p_now timestamptz,
  p_primary_limit integer,
  p_guest_lifetime_limit integer,
  p_guest_daily_limit integer,
  p_ip_daily_limit integer,
  p_global_daily_limit integer
)
returns table (
  allowed boolean,
  usage_event_id uuid,
  used integer,
  remaining integer,
  quota_scope text,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  active_statuses public.ai_case_verdict_usage_status[] := array['succeeded', 'reserved']::public.ai_case_verdict_usage_status[];
  v_global_used integer := 0;
  v_guest_lifetime_used integer := 0;
  v_guest_daily_used integer := 0;
  v_ip_daily_used integer := 0;
  v_user_daily_used integer := 0;
  v_usage_event_id uuid;
begin
  if length(trim(coalesce(p_target_fingerprint, ''))) = 0 then
    raise exception 'target_fingerprint is required';
  end if;

  if p_access_tier::text = 'guest' then
    if p_user_id is not null or length(trim(coalesce(p_guest_key_hash, ''))) = 0 then
      raise exception 'guest usage requires guest_key_hash and no user_id';
    end if;
  else
    if p_user_id is null or p_guest_key_hash is not null then
      raise exception 'authenticated usage requires user_id and no guest_key_hash';
    end if;
  end if;

  -- Serialize quota checks and reservation inserts per UTC bucket so concurrent
  -- requests cannot all pass the count check before a reservation is visible.
  perform pg_advisory_xact_lock(hashtext('ai_case_verdict_usage:' || p_quota_bucket::text)::bigint);

  select count(*)::integer
    into v_global_used
  from public.ai_case_verdict_usage_events
  where quota_bucket = p_quota_bucket
    and status = any(active_statuses)
    and (status <> 'reserved' or expires_at > p_now);

  if v_global_used >= p_global_daily_limit then
    return query select
      false,
      null::uuid,
      v_global_used,
      0,
      'daily'::text,
      'global_daily_cap'::text;
    return;
  end if;

  if p_access_tier::text = 'guest' then
    select count(*)::integer
      into v_guest_lifetime_used
    from public.ai_case_verdict_usage_events
    where guest_key_hash = p_guest_key_hash
      and status = any(active_statuses)
      and (status <> 'reserved' or expires_at > p_now);

    if v_guest_lifetime_used >= p_guest_lifetime_limit then
      return query select
        false,
        null::uuid,
        v_guest_lifetime_used,
        0,
        'lifetime'::text,
        'guest_lifetime_limit'::text;
      return;
    end if;

    select count(*)::integer
      into v_guest_daily_used
    from public.ai_case_verdict_usage_events
    where guest_key_hash = p_guest_key_hash
      and quota_bucket = p_quota_bucket
      and status = any(active_statuses)
      and (status <> 'reserved' or expires_at > p_now);

    if v_guest_daily_used >= p_guest_daily_limit then
      return query select
        false,
        null::uuid,
        v_guest_daily_used,
        0,
        'daily'::text,
        'daily_limit'::text;
      return;
    end if;

    if p_ip_hash is not null then
      select count(*)::integer
        into v_ip_daily_used
      from public.ai_case_verdict_usage_events
      where ip_hash = p_ip_hash
        and quota_bucket = p_quota_bucket
        and status = any(active_statuses)
        and (status <> 'reserved' or expires_at > p_now);

      if v_ip_daily_used >= p_ip_daily_limit then
        return query select
          false,
          null::uuid,
          v_ip_daily_used,
          0,
          'daily'::text,
          'ip_daily_cap'::text;
        return;
      end if;
    end if;

    insert into public.ai_case_verdict_usage_events (
      guest_key_hash,
      ip_hash,
      access_tier,
      target_fingerprint,
      quota_bucket,
      status
    )
    values (
      p_guest_key_hash,
      p_ip_hash,
      p_access_tier,
      p_target_fingerprint,
      p_quota_bucket,
      'reserved'
    )
    returning id into v_usage_event_id;

    return query select
      true,
      v_usage_event_id,
      v_guest_lifetime_used + 1,
      greatest(p_guest_lifetime_limit - (v_guest_lifetime_used + 1), 0),
      'lifetime'::text,
      null::text;
    return;
  end if;

  select count(*)::integer
    into v_user_daily_used
  from public.ai_case_verdict_usage_events
  where user_id = p_user_id
    and access_tier = p_access_tier
    and quota_bucket = p_quota_bucket
    and status = any(active_statuses)
    and (status <> 'reserved' or expires_at > p_now);

  if v_user_daily_used >= p_primary_limit then
    return query select
      false,
      null::uuid,
      v_user_daily_used,
      0,
      'daily'::text,
      case when p_access_tier::text = 'premium' then 'fair_use' else 'daily_limit' end;
    return;
  end if;

  insert into public.ai_case_verdict_usage_events (
    user_id,
    access_tier,
    target_fingerprint,
    quota_bucket,
    status
  )
  values (
    p_user_id,
    p_access_tier,
    p_target_fingerprint,
    p_quota_bucket,
    'reserved'
  )
  returning id into v_usage_event_id;

  return query select
    true,
    v_usage_event_id,
    v_user_daily_used + 1,
    greatest(p_primary_limit - (v_user_daily_used + 1), 0),
    'daily'::text,
    null::text;
end;
$$;

revoke all on function public.reserve_ai_case_verdict_usage(
  uuid,
  text,
  text,
  public.ai_case_verdict_access_tier,
  text,
  date,
  timestamptz,
  integer,
  integer,
  integer,
  integer,
  integer
) from public, anon, authenticated;

grant execute on function public.reserve_ai_case_verdict_usage(
  uuid,
  text,
  text,
  public.ai_case_verdict_access_tier,
  text,
  date,
  timestamptz,
  integer,
  integer,
  integer,
  integer,
  integer
) to service_role;
