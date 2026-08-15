-- A zero-data RPC used by the external keepalive schedule.
-- It performs one real database query without reading or changing app data.

create or replace function public.keep_supabase_active()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select true;
$$;

revoke all on function public.keep_supabase_active() from public;
revoke all on function public.keep_supabase_active() from authenticated;
grant execute on function public.keep_supabase_active() to anon;

comment on function public.keep_supabase_active() is
  'Zero-data health query for the external Supabase Free project keepalive.';
