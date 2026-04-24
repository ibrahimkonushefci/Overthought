import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type EntitlementStatus = 'free' | 'premium' | 'grace_period' | 'expired';
type EntitlementSource = 'none' | 'revenuecat' | 'manual_debug';

interface RevenueCatList<T> {
  items: T[];
  next_page?: string;
}

interface RevenueCatEntitlement {
  id: string;
  lookup_key?: string | null;
}

interface RevenueCatSubscription {
  status: string;
  gives_access: boolean;
  ends_at: number | null;
  current_period_ends_at: number | null;
  product_id: string | null;
  entitlements?: RevenueCatList<RevenueCatEntitlement>;
}

interface PremiumStateRow {
  user_id: string;
  entitlement_status: EntitlementStatus;
  source: EntitlementSource;
  entitlement_id: string | null;
  product_id: string | null;
  expires_at: string | null;
  updated_at: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function bearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

function isoFromMillis(value: number | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

function normalizePremiumState(userId: string, subscriptions: RevenueCatSubscription[]): Omit<PremiumStateRow, 'updated_at'> {
  const sortedSubscriptions = [...subscriptions].sort((left, right) => {
    const leftTime = left.current_period_ends_at ?? left.ends_at ?? 0;
    const rightTime = right.current_period_ends_at ?? right.ends_at ?? 0;
    return rightTime - leftTime;
  });

  const activeSubscription = sortedSubscriptions.find((item) => item.gives_access) ?? null;

  if (activeSubscription) {
    const entitlement = activeSubscription.entitlements?.items[0];

    return {
      user_id: userId,
      entitlement_status:
        activeSubscription.status === 'in_grace_period' || activeSubscription.status === 'in_billing_retry'
          ? 'grace_period'
          : 'premium',
      source: 'revenuecat',
      entitlement_id: entitlement?.lookup_key ?? entitlement?.id ?? null,
      product_id: activeSubscription.product_id,
      expires_at: isoFromMillis(activeSubscription.current_period_ends_at ?? activeSubscription.ends_at),
    };
  }

  const mostRecentSubscription = sortedSubscriptions[0] ?? null;

  if (mostRecentSubscription) {
    const entitlement = mostRecentSubscription.entitlements?.items[0];

    return {
      user_id: userId,
      entitlement_status: 'expired',
      source: 'revenuecat',
      entitlement_id: entitlement?.lookup_key ?? entitlement?.id ?? null,
      product_id: mostRecentSubscription.product_id,
      expires_at: isoFromMillis(mostRecentSubscription.current_period_ends_at ?? mostRecentSubscription.ends_at),
    };
  }

  return {
    user_id: userId,
    entitlement_status: 'free',
    source: 'revenuecat',
    entitlement_id: null,
    product_id: null,
    expires_at: null,
  };
}

async function fetchRevenueCatSubscriptions(projectId: string, customerId: string, apiKey: string) {
  const subscriptions: RevenueCatSubscription[] = [];
  let nextPath = `/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(customerId)}/subscriptions?limit=100`;

  while (nextPath) {
    const response = await fetch(`https://api.revenuecat.com${nextPath}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`RevenueCat sync failed (${response.status}): ${message}`);
    }

    const payload = (await response.json()) as RevenueCatList<RevenueCatSubscription>;
    subscriptions.push(...payload.items);
    nextPath = payload.next_page ?? '';
  }

  return subscriptions;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, code: 'method_not_allowed', message: 'Method not allowed.' }, 405);
  }

  const token = bearerToken(request);

  if (!token) {
    return json({ ok: false, code: 'not_authenticated', message: 'Missing authorization header.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const revenueCatProjectId = Deno.env.get('REVENUECAT_PROJECT_ID') ?? '';
  const revenueCatSecretApiKey = Deno.env.get('REVENUECAT_SECRET_API_KEY') ?? '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, code: 'not_configured', message: 'Supabase function secrets are missing.' }, 503);
  }

  if (!revenueCatProjectId || !revenueCatSecretApiKey) {
    return json({ ok: false, code: 'not_configured', message: 'RevenueCat server sync is not configured.' }, 503);
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await authClient.auth.getUser(token);

  if (userError || !userData.user) {
    return json({ ok: false, code: 'not_authenticated', message: 'Invalid auth token.' }, 401);
  }

  try {
    const subscriptions = await fetchRevenueCatSubscriptions(
      revenueCatProjectId,
      userData.user.id,
      revenueCatSecretApiKey,
    );
    const nextState = normalizePremiumState(userData.user.id, subscriptions);
    const { data, error } = await adminClient
      .from('premium_states')
      .upsert(nextState, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error || !data) {
      throw error ?? new Error('Premium state upsert returned no data.');
    }

    return json({
      ok: true,
      premiumState: data,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        code: 'sync_failed',
        message: error instanceof Error ? error.message : 'Unable to sync premium state.',
      },
      500,
    );
  }
});
