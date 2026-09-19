-- Additive Smart-only case creation foundation.
-- Existing case, AI verdict, usage, and Deep Read records remain unchanged.

alter table public.cases
  add column if not exists creation_request_id text;

alter table public.ai_case_verdict_usage_events
  add column if not exists request_id text;

create unique index if not exists idx_cases_user_creation_request
  on public.cases (user_id, creation_request_id)
  where creation_request_id is not null;

create unique index if not exists idx_ai_usage_user_request
  on public.ai_case_verdict_usage_events (user_id, request_id)
  where user_id is not null and request_id is not null;

create unique index if not exists idx_ai_usage_guest_request
  on public.ai_case_verdict_usage_events (guest_key_hash, request_id)
  where guest_key_hash is not null and request_id is not null;

create or replace function public.reserve_smart_case_creation_usage(
  p_request_id text,
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
  request_state text,
  usage_event_id uuid,
  case_id uuid,
  ai_case_verdict_id uuid,
  ai_guest_case_verdict_id uuid,
  verdict jsonb,
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
  v_existing public.ai_case_verdict_usage_events%rowtype;
  v_reserved record;
  v_identity text;
begin
  if length(trim(coalesce(p_request_id, ''))) < 16 then
    raise exception 'request_id is required';
  end if;

  v_identity := case
    when p_user_id is not null then 'user:' || p_user_id::text
    else 'guest:' || coalesce(p_guest_key_hash, '')
  end;
  perform pg_advisory_xact_lock(hashtext('smart-case:' || v_identity || ':' || p_request_id)::bigint);

  select * into v_existing
  from public.ai_case_verdict_usage_events e
  where e.request_id = p_request_id
    and (
      (p_user_id is not null and e.user_id = p_user_id)
      or
      (p_user_id is null and e.guest_key_hash = p_guest_key_hash)
    )
  limit 1;

  if found then
    if v_existing.target_fingerprint <> p_target_fingerprint then
      raise exception 'request_id cannot be reused for different input';
    end if;

    if v_existing.status = 'succeeded' then
      return query select
        true,
        'completed'::text,
        v_existing.id,
        c.id,
        v_existing.ai_case_verdict_id,
        v_existing.ai_guest_case_verdict_id,
        case
          when v_existing.ai_case_verdict_id is not null then
            (select to_jsonb(v) from public.ai_case_verdicts v where v.id = v_existing.ai_case_verdict_id)
          else
            (select to_jsonb(v) from public.ai_guest_case_verdicts v where v.id = v_existing.ai_guest_case_verdict_id)
        end,
        0,
        0,
        case when p_access_tier::text = 'guest' then 'lifetime' else 'daily' end,
        null::text
      from (select 1) seed
      left join public.cases c
        on c.user_id = p_user_id and c.creation_request_id = p_request_id;
      return;
    end if;

    if v_existing.status = 'reserved' and v_existing.expires_at > p_now then
      return query select
        false, 'in_progress'::text, v_existing.id, null::uuid, null::uuid, null::uuid, null::jsonb,
        0, 0,
        case when p_access_tier::text = 'guest' then 'lifetime' else 'daily' end,
        'in_progress'::text;
      return;
    end if;

    update public.ai_case_verdict_usage_events
    set request_id = null
    where id = v_existing.id;
  end if;

  select * into v_reserved
  from public.reserve_ai_case_verdict_usage(
    p_user_id,
    p_guest_key_hash,
    p_ip_hash,
    p_access_tier,
    p_target_fingerprint,
    p_quota_bucket,
    p_now,
    p_primary_limit,
    p_guest_lifetime_limit,
    p_guest_daily_limit,
    p_ip_daily_limit,
    p_global_daily_limit
  );

  if not v_reserved.allowed then
    return query select
      false, 'rejected'::text, null::uuid, null::uuid, null::uuid, null::uuid, null::jsonb,
      v_reserved.used, v_reserved.remaining, v_reserved.quota_scope, v_reserved.reason;
    return;
  end if;

  update public.ai_case_verdict_usage_events
  set request_id = p_request_id
  where id = v_reserved.usage_event_id;

  return query select
    true, 'reserved'::text, v_reserved.usage_event_id, null::uuid, null::uuid, null::uuid, null::jsonb,
    v_reserved.used, v_reserved.remaining, v_reserved.quota_scope, null::text;
end;
$$;

create or replace function public.complete_smart_case_creation(
  p_usage_event_id uuid,
  p_request_id text,
  p_user_id uuid,
  p_title text,
  p_input_text text,
  p_verdict jsonb
)
returns table (case_id uuid, ai_case_verdict_id uuid, verdict jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_id uuid;
  v_verdict_id uuid;
begin
  perform 1
  from public.ai_case_verdict_usage_events e
  where e.id = p_usage_event_id
    and e.user_id = p_user_id
    and e.request_id = p_request_id
    and e.status = 'reserved'
  for update;

  if not found then
    raise exception 'active Smart creation reservation not found';
  end if;

  insert into public.cases (
    user_id, creation_request_id, title, category, input_text,
    verdict_label, delusion_score, explanation_text, next_move_text,
    latest_verdict_version, last_analyzed_at
  ) values (
    p_user_id,
    p_request_id,
    nullif(trim(p_title), ''),
    (p_verdict->>'category')::public.case_category,
    p_input_text,
    (p_verdict->>'local_verdict_label')::public.verdict_label,
    (p_verdict->>'local_delusion_score')::integer,
    p_verdict->>'local_explanation_text',
    p_verdict->>'local_next_move_text',
    (p_verdict->>'local_verdict_version')::integer,
    timezone('utc', now())
  ) returning id into v_case_id;

  insert into public.ai_case_verdicts (
    user_id, case_id, target_fingerprint, category,
    local_verdict_label, local_delusion_score, local_explanation_text,
    local_next_move_text, local_verdict_version,
    verdict_label, delusion_score, display_label, explanation_text,
    evidence_check_text, overreading_text, what_matters_text, next_move_text,
    verdict_version, model_provider, model_name, model_version,
    prompt_version, response_schema_version
  ) values (
    p_user_id, v_case_id, p_verdict->>'target_fingerprint',
    (p_verdict->>'category')::public.case_category,
    (p_verdict->>'local_verdict_label')::public.verdict_label,
    (p_verdict->>'local_delusion_score')::integer,
    p_verdict->>'local_explanation_text', p_verdict->>'local_next_move_text',
    (p_verdict->>'local_verdict_version')::integer,
    (p_verdict->>'verdict_label')::public.verdict_label,
    (p_verdict->>'delusion_score')::integer, p_verdict->>'display_label',
    p_verdict->>'explanation_text', p_verdict->>'evidence_check_text',
    p_verdict->>'overreading_text', p_verdict->>'what_matters_text',
    p_verdict->>'next_move_text', (p_verdict->>'verdict_version')::integer,
    p_verdict->>'model_provider', p_verdict->>'model_name', p_verdict->>'model_version',
    (p_verdict->>'prompt_version')::integer,
    (p_verdict->>'response_schema_version')::integer
  ) returning id into v_verdict_id;

  update public.ai_case_verdict_usage_events
  set status = 'succeeded', ai_case_verdict_id = v_verdict_id,
      finalized_at = timezone('utc', now()), failure_code = null
  where id = p_usage_event_id;

  return query
  select v_case_id, v_verdict_id, to_jsonb(v)
  from public.ai_case_verdicts v
  where v.id = v_verdict_id;
end;
$$;

create or replace function public.complete_guest_smart_case_creation(
  p_usage_event_id uuid,
  p_request_id text,
  p_verdict jsonb
)
returns table (ai_guest_case_verdict_id uuid, verdict jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verdict_id uuid;
  v_guest_key_hash text;
begin
  select e.guest_key_hash into v_guest_key_hash
  from public.ai_case_verdict_usage_events e
  where e.id = p_usage_event_id
    and e.request_id = p_request_id
    and e.status = 'reserved'
    and e.access_tier = 'guest'
  for update;

  if not found then
    raise exception 'active guest Smart creation reservation not found';
  end if;

  insert into public.ai_guest_case_verdicts (
    guest_key_hash, target_fingerprint, category,
    local_verdict_label, local_delusion_score, local_explanation_text,
    local_next_move_text, local_verdict_version,
    verdict_label, delusion_score, display_label, explanation_text,
    evidence_check_text, overreading_text, what_matters_text, next_move_text,
    verdict_version, model_provider, model_name, model_version,
    prompt_version, response_schema_version
  ) values (
    v_guest_key_hash, p_verdict->>'target_fingerprint',
    (p_verdict->>'category')::public.case_category,
    (p_verdict->>'local_verdict_label')::public.verdict_label,
    (p_verdict->>'local_delusion_score')::integer,
    p_verdict->>'local_explanation_text', p_verdict->>'local_next_move_text',
    (p_verdict->>'local_verdict_version')::integer,
    (p_verdict->>'verdict_label')::public.verdict_label,
    (p_verdict->>'delusion_score')::integer, p_verdict->>'display_label',
    p_verdict->>'explanation_text', p_verdict->>'evidence_check_text',
    p_verdict->>'overreading_text', p_verdict->>'what_matters_text',
    p_verdict->>'next_move_text', (p_verdict->>'verdict_version')::integer,
    p_verdict->>'model_provider', p_verdict->>'model_name', p_verdict->>'model_version',
    (p_verdict->>'prompt_version')::integer,
    (p_verdict->>'response_schema_version')::integer
  ) returning id into v_verdict_id;

  update public.ai_case_verdict_usage_events
  set status = 'succeeded', ai_guest_case_verdict_id = v_verdict_id,
      finalized_at = timezone('utc', now()), failure_code = null
  where id = p_usage_event_id;

  return query
  select v_verdict_id, to_jsonb(v)
  from public.ai_guest_case_verdicts v
  where v.id = v_verdict_id;
end;
$$;

create or replace view public.canonical_case_results
with (security_invoker = true)
as
select
  c.id,
  c.user_id,
  c.guest_local_id,
  c.creation_request_id,
  c.title,
  c.category,
  c.input_text,
  c.outcome_status,
  c.last_analyzed_at,
  c.created_at,
  c.updated_at,
  c.archived_at,
  c.deleted_at,
  case when smart.id is null then 'legacy_basic' else 'smart' end as result_source,
  coalesce(smart.verdict_label, c.verdict_label) as verdict_label,
  coalesce(smart.delusion_score, c.delusion_score) as delusion_score,
  coalesce(smart.explanation_text, c.explanation_text) as explanation_text,
  coalesce(smart.next_move_text, c.next_move_text) as next_move_text,
  coalesce(smart.verdict_version, c.latest_verdict_version) as verdict_version,
  smart.display_label,
  smart.evidence_check_text,
  smart.overreading_text,
  smart.what_matters_text,
  smart.id as smart_verdict_id,
  smart.created_at as smart_created_at
from public.cases c
left join lateral (
  select v.*
  from public.ai_case_verdicts v
  where v.case_id = c.id and v.user_id = c.user_id
  order by v.created_at desc, v.id desc
  limit 1
) smart on true;

revoke all on function public.reserve_smart_case_creation_usage(
  text, uuid, text, text, public.ai_case_verdict_access_tier, text, date,
  timestamptz, integer, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.reserve_smart_case_creation_usage(
  text, uuid, text, text, public.ai_case_verdict_access_tier, text, date,
  timestamptz, integer, integer, integer, integer, integer
) to service_role;

revoke all on function public.complete_smart_case_creation(uuid, text, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_smart_case_creation(uuid, text, uuid, text, text, jsonb)
  to service_role;

revoke all on function public.complete_guest_smart_case_creation(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_guest_smart_case_creation(uuid, text, jsonb)
  to service_role;

grant select on public.canonical_case_results to authenticated;
