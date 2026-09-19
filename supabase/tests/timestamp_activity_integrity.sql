begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(3);

set local timezone = 'Europe/Belgrade';

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '33333333-3333-4333-8333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'timestamp-local@example.com', '',
  now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.profiles (id, email, auth_provider, onboarding_completed, is_guest)
values ('33333333-3333-4333-8333-333333333333', 'timestamp-local@example.com', 'email', true, false)
on conflict (id) do nothing;

insert into public.cases (
  id, user_id, title, category, input_text,
  verdict_label, delusion_score, explanation_text, next_move_text
) values (
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  'Timestamp test', 'general', 'A sufficiently detailed social situation for timestamp testing.',
  'mild_delusion', 50, 'The facts are mixed.', 'Wait for clearer evidence.'
);

select extensions.ok(
  abs(extract(epoch from ((select created_at from public.cases where id = '44444444-4444-4444-8444-444444444444') - now()))) < 2,
  'timestamptz defaults preserve the current instant in a non-UTC session'
);

insert into public.case_updates (id, case_id, update_text, created_at)
values (
  '55555555-5555-4555-8555-555555555555',
  '44444444-4444-4444-8444-444444444444',
  'A later receipt arrived.',
  now() + interval '5 minutes'
);

select extensions.ok(
  (
    select latest_update_at = latest_activity_at
    from public.canonical_case_results
    where id = '44444444-4444-4444-8444-444444444444'
  ),
  'canonical case activity follows the newest case update'
);

select extensions.ok(
  has_table_privilege('authenticated', 'public.canonical_case_results', 'SELECT')
    and not has_table_privilege('anon', 'public.canonical_case_results', 'SELECT'),
  'canonical activity view keeps authenticated-only read grants'
);

select * from extensions.finish();

rollback;
