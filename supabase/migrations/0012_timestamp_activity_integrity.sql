-- Make timestamptz writes independent of the database session timezone and
-- expose one canonical latest-activity instant for case lists.

alter table public.profiles
  alter column created_at set default now(),
  alter column updated_at set default now();
alter table public.user_preferences
  alter column created_at set default now(),
  alter column updated_at set default now();
alter table public.premium_states
  alter column updated_at set default now();
alter table public.cases
  alter column last_analyzed_at set default now(),
  alter column created_at set default now(),
  alter column updated_at set default now();
alter table public.case_updates
  alter column created_at set default now();
alter table public.analytics_debug_events
  alter column created_at set default now();
alter table public.ai_deep_reads
  alter column created_at set default now(),
  alter column updated_at set default now();
alter table public.ai_deep_read_usage_events
  alter column created_at set default now(),
  alter column expires_at set default (now() + interval '10 minutes');
alter table public.ai_case_verdicts
  alter column created_at set default now(),
  alter column updated_at set default now();
alter table public.ai_guest_case_verdicts
  alter column created_at set default now(),
  alter column updated_at set default now();
alter table public.ai_case_verdict_usage_events
  alter column created_at set default now(),
  alter column expires_at set default (now() + interval '10 minutes');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
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
    now()
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
      finalized_at = now(), failure_code = null
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
      finalized_at = now(), failure_code = null
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
  smart.created_at as smart_created_at,
  latest_update.created_at as latest_update_at,
  greatest(
    c.created_at,
    c.updated_at,
    c.last_analyzed_at,
    coalesce(smart.created_at, c.created_at),
    coalesce(latest_update.created_at, c.created_at)
  ) as latest_activity_at
from public.cases c
left join lateral (
  select v.*
  from public.ai_case_verdicts v
  where v.case_id = c.id and v.user_id = c.user_id
  order by v.created_at desc, v.id desc
  limit 1
) smart on true
left join lateral (
  select u.created_at
  from public.case_updates u
  where u.case_id = c.id
  order by u.created_at desc, u.id desc
  limit 1
) latest_update on true;

revoke all on public.canonical_case_results from public, anon, authenticated, service_role;
grant select on public.canonical_case_results to authenticated, service_role;

revoke all on function public.complete_smart_case_creation(uuid, text, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_smart_case_creation(uuid, text, uuid, text, text, jsonb)
  to service_role;
revoke all on function public.complete_guest_smart_case_creation(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_guest_smart_case_creation(uuid, text, jsonb)
  to service_role;
