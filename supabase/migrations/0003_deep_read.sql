-- AI Deep Read storage and usage accounting.
-- Notes:
-- - The deterministic local verdict remains canonical.
-- - Deep Read is enrichment only.
-- - Guest Deep Read output remains local-only in v1; this schema stores authenticated cache rows.
-- - Usage events intentionally store fingerprints and metadata, not raw case text.

DO $$ BEGIN
  CREATE TYPE public.ai_deep_read_target_type AS ENUM ('case', 'case_update');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_deep_read_access_tier AS ENUM ('guest', 'free', 'premium');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_deep_read_usage_status AS ENUM ('reserved', 'succeeded', 'failed', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

create table if not exists public.ai_deep_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  case_update_id uuid references public.case_updates(id) on delete cascade,
  target_type public.ai_deep_read_target_type not null,
  target_fingerprint text not null,
  category public.case_category not null,
  local_verdict_label public.verdict_label not null,
  local_delusion_score integer not null check (local_delusion_score >= 0 and local_delusion_score <= 100),
  local_verdict_version integer not null,
  model_provider text not null,
  model_name text not null,
  model_version text,
  prompt_version integer not null,
  response_schema_version integer not null,
  response_json jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_deep_reads_target_shape check (
    (
      target_type = 'case'
      and case_id is not null
      and case_update_id is null
    )
    or
    (
      target_type = 'case_update'
      and case_id is not null
      and case_update_id is not null
    )
  ),
  constraint ai_deep_reads_model_provider_not_blank check (length(trim(model_provider)) > 0),
  constraint ai_deep_reads_model_name_not_blank check (length(trim(model_name)) > 0),
  constraint ai_deep_reads_target_fingerprint_not_blank check (length(trim(target_fingerprint)) > 0),
  constraint ai_deep_reads_response_json_shape check (
    jsonb_typeof(response_json) = 'object'
    and jsonb_typeof(response_json->'whatsActuallyHappening') = 'string'
    and jsonb_typeof(response_json->'whatYoureOverreading') = 'string'
    and jsonb_typeof(response_json->'whatEvidenceActuallyMatters') = 'string'
    and jsonb_typeof(response_json->'whatToDoNext') = 'string'
    and jsonb_typeof(response_json->'roastLine') = 'string'
  )
);

create table if not exists public.ai_deep_read_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  guest_key_hash text,
  access_tier public.ai_deep_read_access_tier not null,
  target_type public.ai_deep_read_target_type not null,
  target_fingerprint text not null,
  quota_bucket date not null default (timezone('utc', now()))::date,
  status public.ai_deep_read_usage_status not null default 'reserved',
  ai_deep_read_id uuid references public.ai_deep_reads(id) on delete cascade,
  failure_code text,
  created_at timestamptz not null default timezone('utc', now()),
  finalized_at timestamptz,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '10 minutes'),
  constraint ai_deep_read_usage_identity check (
    (
      access_tier = 'guest'
      and user_id is null
      and guest_key_hash is not null
    )
    or
    (
      access_tier in ('free', 'premium')
      and user_id is not null
      and guest_key_hash is null
    )
  ),
  constraint ai_deep_read_usage_guest_hash_not_blank check (
    guest_key_hash is null or length(trim(guest_key_hash)) > 0
  ),
  constraint ai_deep_read_usage_target_fingerprint_not_blank check (length(trim(target_fingerprint)) > 0),
  constraint ai_deep_read_usage_success_shape check (
    (
      status = 'succeeded'
      and ai_deep_read_id is not null
      and failure_code is null
      and finalized_at is not null
    )
    or
    (
      status = 'reserved'
      and ai_deep_read_id is null
      and failure_code is null
      and finalized_at is null
    )
    or
    (
      status in ('failed', 'expired')
      and ai_deep_read_id is null
      and failure_code is not null
      and finalized_at is not null
    )
  )
);

create unique index if not exists idx_ai_deep_reads_cache_key
  on public.ai_deep_reads (
    user_id,
    target_type,
    target_fingerprint,
    model_provider,
    model_name,
    prompt_version,
    response_schema_version
  );

create index if not exists idx_ai_deep_reads_user_created_at
  on public.ai_deep_reads (user_id, created_at desc);

create index if not exists idx_ai_deep_reads_case_id
  on public.ai_deep_reads (case_id);

create index if not exists idx_ai_deep_reads_case_update_id
  on public.ai_deep_reads (case_update_id)
  where case_update_id is not null;

create index if not exists idx_ai_deep_read_usage_user_bucket_status
  on public.ai_deep_read_usage_events (user_id, quota_bucket, status)
  where user_id is not null;

create index if not exists idx_ai_deep_read_usage_guest_status
  on public.ai_deep_read_usage_events (guest_key_hash, status)
  where guest_key_hash is not null;

create index if not exists idx_ai_deep_read_usage_reserved_expires
  on public.ai_deep_read_usage_events (expires_at)
  where status = 'reserved';

DROP TRIGGER IF EXISTS trg_ai_deep_reads_set_updated_at ON public.ai_deep_reads;
create trigger trg_ai_deep_reads_set_updated_at
  before update on public.ai_deep_reads
  for each row execute procedure public.set_updated_at();

alter table public.ai_deep_reads enable row level security;
alter table public.ai_deep_read_usage_events enable row level security;

-- Users may read their own cached authenticated Deep Reads.
-- Writes are intentionally server-only through future Edge Functions using the service role.
DROP POLICY IF EXISTS "ai_deep_reads_select_own" ON public.ai_deep_reads;
create policy "ai_deep_reads_select_own"
  on public.ai_deep_reads for select
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.cases c
      where c.id = ai_deep_reads.case_id
        and c.user_id = auth.uid()
        and c.archived_at is null
        and c.deleted_at is null
    )
  );

-- Usage events remain server-managed quota/accounting data.
-- No client policies are created in v1.
