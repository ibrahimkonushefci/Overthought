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
  active_case_statuses public.ai_case_verdict_usage_status[] := array['succeeded', 'reserved']::public.ai_case_verdict_usage_status[];
  active_deep_read_statuses public.ai_deep_read_usage_status[] := array['succeeded', 'reserved']::public.ai_deep_read_usage_status[];
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
    and status = any(active_case_statuses)
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
      and status = any(active_case_statuses)
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
      and status = any(active_case_statuses)
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
        and status = any(active_case_statuses)
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

  select coalesce(sum(usage_count), 0)::integer
    into v_user_daily_used
  from (
    select count(*)::integer as usage_count
    from public.ai_case_verdict_usage_events
    where user_id = p_user_id
      and access_tier = p_access_tier
      and quota_bucket = p_quota_bucket
      and status = any(active_case_statuses)
      and (status <> 'reserved' or expires_at > p_now)
    union all
    select count(*)::integer as usage_count
    from public.ai_deep_read_usage_events
    where user_id = p_user_id
      and access_tier::text = p_access_tier::text
      and quota_bucket = p_quota_bucket
      and status = any(active_deep_read_statuses)
      and (status <> 'reserved' or expires_at > p_now)
  ) active_usage;

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
