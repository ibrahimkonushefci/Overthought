begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(1);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '11111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'phase2-local@example.com', '',
  timezone('utc', now()), '{}'::jsonb, '{}'::jsonb, timezone('utc', now()), timezone('utc', now())
);

insert into public.profiles (id, email, auth_provider, onboarding_completed, is_guest)
values ('11111111-1111-4111-8111-111111111111', 'phase2-local@example.com', 'email', true, false)
on conflict (id) do nothing;

insert into public.ai_guest_case_verdicts (
  id, guest_key_hash, target_fingerprint, category,
  local_verdict_label, local_delusion_score, local_explanation_text,
  local_next_move_text, local_verdict_version,
  verdict_label, delusion_score, display_label, explanation_text,
  evidence_check_text, overreading_text, what_matters_text, next_move_text,
  verdict_version, model_provider, model_name, model_version,
  prompt_version, response_schema_version
) values (
  '22222222-2222-4222-8222-222222222222', 'verified-guest-hash', 'verified-fingerprint', 'friendship',
  'mild_delusion', 50, 'Internal Basic calibration.', 'Wait for a concrete plan.', 1,
  'dangerous_overthinking', 78, 'No Plan, No Weekend', 'The intention is not a plan.',
  'There is no day or time.', 'You are upgrading a maybe into a booking.',
  'Concrete follow-through is what matters.', 'Suggest one time and let the answer be the answer.',
  1, 'gemini', 'gemini-2.5-flash', null, 6, 2
);

select * from public.migrate_verified_guest_smart_case(
  '11111111-1111-4111-8111-111111111111',
  'verified-guest-hash',
  '22222222-2222-4222-8222-222222222222',
  'local-case-phase2',
  'Friendship weekend',
  'friendship',
  'My friend said they wanted to meet this weekend but never chose a day or time.',
  'unknown',
  '2026-09-17T10:00:00.000Z',
  '2026-09-17T10:00:00.000Z',
  null
);

-- Retry must be idempotent and reuse the same authenticated case and Smart row.
select * from public.migrate_verified_guest_smart_case(
  '11111111-1111-4111-8111-111111111111',
  'verified-guest-hash',
  '22222222-2222-4222-8222-222222222222',
  'local-case-phase2',
  'Friendship weekend',
  'friendship',
  'My friend said they wanted to meet this weekend but never chose a day or time.',
  'unknown',
  '2026-09-17T10:00:00.000Z',
  '2026-09-17T10:00:00.000Z',
  null
);

do $$
declare
  v_case_count integer;
  v_smart_count integer;
  v_source text;
  v_score integer;
begin
  select count(*) into v_case_count
  from public.cases
  where user_id = '11111111-1111-4111-8111-111111111111'
    and guest_local_id = 'local-case-phase2';

  select count(*) into v_smart_count
  from public.ai_case_verdicts v
  join public.cases c on c.id = v.case_id
  where c.user_id = '11111111-1111-4111-8111-111111111111'
    and c.guest_local_id = 'local-case-phase2';

  select result_source, delusion_score into v_source, v_score
  from public.canonical_case_results
  where user_id = '11111111-1111-4111-8111-111111111111'
    and guest_local_id = 'local-case-phase2';

  if v_case_count <> 1 or v_smart_count <> 1 then
    raise exception 'verified guest migration is not idempotent: cases %, Smart rows %', v_case_count, v_smart_count;
  end if;

  if v_source <> 'smart' or v_score <> 78 then
    raise exception 'canonical migrated result is wrong: source %, score %', v_source, v_score;
  end if;

  if has_function_privilege('authenticated', 'public.migrate_verified_guest_smart_case(uuid,text,uuid,text,text,public.case_category,text,public.outcome_status,timestamptz,timestamptz,timestamptz)', 'EXECUTE') then
    raise exception 'authenticated role must not execute verified guest migration RPC directly';
  end if;
end
$$;

-- A different guest identity must not be able to copy the verified Smart row.
do $$
declare
  v_rows integer;
begin
  select count(*) into v_rows
  from public.migrate_verified_guest_smart_case(
    '11111111-1111-4111-8111-111111111111',
    'wrong-guest-hash',
    '22222222-2222-4222-8222-222222222222',
    'local-case-unverified',
    'Unverified case',
    'friendship',
    'My friend said they wanted to meet this weekend but never chose a day or time.',
    'unknown',
    '2026-09-17T10:00:00.000Z',
    '2026-09-17T10:00:00.000Z',
    null
  );

  if v_rows <> 0 then
    raise exception 'unverified guest Smart row was copied';
  end if;
end
$$;

select extensions.pass(
  'verified guest Smart migration is idempotent, canonical, and service-role-only'
);

select * from extensions.finish();

rollback;
