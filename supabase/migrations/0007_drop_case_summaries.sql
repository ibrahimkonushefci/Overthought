-- Security fix: drop the public.case_summaries view.
--
-- The view (defined in 0001_initial_schema.sql) selected case rows across all
-- users. Postgres views run with the view owner's privileges by default, and
-- this view was created without `security_invoker`, so it bypassed the RLS
-- policies on public.cases. Combined with the default SELECT grant to anon /
-- authenticated on new public-schema objects, any caller with the anon key
-- could read every user's case id, title (derived from the user's case text),
-- category, verdict, and score.
--
-- No application code references this view (verified across the repo), so the
-- clean fix is to drop it. If a summaries view is ever needed again, recreate
-- it with `WITH (security_invoker = on)` and an explicit `auth.uid()` filter,
-- and revoke the default anon grant.

drop view if exists public.case_summaries;
