-- Restrict the canonical authenticated case view to least-privilege reads.
-- Supabase's default public-schema privileges grant new views to anon and
-- authenticated roles, so explicitly replace those defaults here.

revoke all on public.canonical_case_results from public, anon, authenticated, service_role;
grant select on public.canonical_case_results to authenticated, service_role;
