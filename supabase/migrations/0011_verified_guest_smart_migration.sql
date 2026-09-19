-- Copy a server-verified guest Smart Verdict into an authenticated case.
-- The client supplies case text and metadata, but never supplies AI result text.

create or replace function public.migrate_verified_guest_smart_case(
  p_user_id uuid,
  p_guest_key_hash text,
  p_guest_verdict_id uuid,
  p_guest_local_id text,
  p_title text,
  p_category public.case_category,
  p_input_text text,
  p_outcome_status public.outcome_status,
  p_created_at timestamptz,
  p_updated_at timestamptz,
  p_archived_at timestamptz
)
returns table (case_id uuid, ai_case_verdict_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.ai_guest_case_verdicts%rowtype;
  v_case_id uuid;
  v_verdict_id uuid;
begin
  if length(trim(coalesce(p_guest_local_id, ''))) = 0
    or length(trim(coalesce(p_input_text, ''))) < 30
    or length(trim(coalesce(p_input_text, ''))) > 400 then
    raise exception 'invalid guest case migration input';
  end if;

  perform pg_advisory_xact_lock(hashtext('guest-migration:' || p_user_id::text || ':' || p_guest_local_id)::bigint);

  select * into v_guest
  from public.ai_guest_case_verdicts g
  where g.id = p_guest_verdict_id
    and g.guest_key_hash = p_guest_key_hash
    and g.category = p_category;

  if not found then
    return;
  end if;

  select c.id into v_case_id
  from public.cases c
  where c.user_id = p_user_id and c.guest_local_id = p_guest_local_id
  limit 1;

  if v_case_id is null then
    insert into public.cases (
      user_id, guest_local_id, title, category, input_text,
      verdict_label, delusion_score, explanation_text, next_move_text,
      outcome_status, latest_verdict_version, last_analyzed_at,
      created_at, updated_at, archived_at
    ) values (
      p_user_id, p_guest_local_id, nullif(trim(p_title), ''), v_guest.category, trim(p_input_text),
      v_guest.local_verdict_label, v_guest.local_delusion_score,
      v_guest.local_explanation_text, v_guest.local_next_move_text,
      p_outcome_status, v_guest.local_verdict_version, p_created_at,
      p_created_at, greatest(p_updated_at, p_created_at), p_archived_at
    ) returning id into v_case_id;
  end if;

  select v.id into v_verdict_id
  from public.ai_case_verdicts v
  where v.user_id = p_user_id
    and v.case_id = v_case_id
    and v.target_fingerprint = v_guest.target_fingerprint
  order by v.created_at desc
  limit 1;

  if v_verdict_id is null then
    insert into public.ai_case_verdicts (
      user_id, case_id, target_fingerprint, category,
      local_verdict_label, local_delusion_score, local_explanation_text,
      local_next_move_text, local_verdict_version,
      verdict_label, delusion_score, display_label, explanation_text,
      evidence_check_text, overreading_text, what_matters_text, next_move_text,
      verdict_version, model_provider, model_name, model_version,
      prompt_version, response_schema_version, created_at, updated_at
    ) values (
      p_user_id, v_case_id, v_guest.target_fingerprint, v_guest.category,
      v_guest.local_verdict_label, v_guest.local_delusion_score, v_guest.local_explanation_text,
      v_guest.local_next_move_text, v_guest.local_verdict_version,
      v_guest.verdict_label, v_guest.delusion_score, v_guest.display_label, v_guest.explanation_text,
      v_guest.evidence_check_text, v_guest.overreading_text, v_guest.what_matters_text, v_guest.next_move_text,
      v_guest.verdict_version, v_guest.model_provider, v_guest.model_name, v_guest.model_version,
      v_guest.prompt_version, v_guest.response_schema_version, v_guest.created_at, v_guest.updated_at
    ) returning id into v_verdict_id;
  end if;

  return query select v_case_id, v_verdict_id;
end;
$$;

revoke all on function public.migrate_verified_guest_smart_case(
  uuid, text, uuid, text, text, public.case_category, text,
  public.outcome_status, timestamptz, timestamptz, timestamptz
) from public, anon, authenticated;

grant execute on function public.migrate_verified_guest_smart_case(
  uuid, text, uuid, text, text, public.case_category, text,
  public.outcome_status, timestamptz, timestamptz, timestamptz
) to service_role;
