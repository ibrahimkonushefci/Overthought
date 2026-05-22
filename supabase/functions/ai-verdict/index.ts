import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import {
  generateAiVerdictWithGemini,
  handleAiVerdictRequest,
  type AiVerdictAccessState,
  type AiVerdictCacheLookupInput,
  type AiVerdictStoredRow,
  type AiVerdictUsageReservationInput,
  type AiVerdictUsageReservationResult,
  type CaseRow,
  type GuestAiVerdictCacheLookupInput,
  type InsertAuthenticatedAiVerdictInput,
  type InsertGuestAiVerdictInput,
} from './core.ts';

const MODEL_PROVIDER = 'gemini';
const MODEL_NAME = 'gemini-2.5-flash';
const PROMPT_VERSION = 3;
const RESPONSE_SCHEMA_VERSION = 2;
const SIGNED_IN_FREE_DAILY_LIMIT = 2;
const GUEST_LIFETIME_LIMIT = 2;
const GUEST_DAILY_LIMIT = 2;
const GUEST_IP_DAILY_LIMIT = 10;
const GLOBAL_DAILY_LIMIT = 100;

type EntitlementStatus = 'free' | 'premium' | 'grace_period' | 'expired';

interface PremiumStateRow {
  entitlement_status: EntitlementStatus;
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name)?.trim();

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function aiVerdictConfig() {
  return {
    signedInFreeDailyLimit: positiveIntegerEnv('AI_VERDICT_SIGNED_IN_FREE_DAILY_LIMIT', SIGNED_IN_FREE_DAILY_LIMIT),
    guestLifetimeLimit: positiveIntegerEnv('AI_VERDICT_GUEST_LIFETIME_LIMIT', GUEST_LIFETIME_LIMIT),
    guestDailyLimit: positiveIntegerEnv('AI_VERDICT_GUEST_DAILY_LIMIT', GUEST_DAILY_LIMIT),
    guestIpDailyLimit: positiveIntegerEnv('AI_VERDICT_GUEST_IP_DAILY_LIMIT', GUEST_IP_DAILY_LIMIT),
    globalDailyLimit: positiveIntegerEnv('AI_VERDICT_GLOBAL_DAILY_LIMIT', GLOBAL_DAILY_LIMIT),
    premiumDailyLimit: positiveIntegerEnv('AI_VERDICT_PREMIUM_DAILY_LIMIT', 50),
  };
}

function logAiVerdictOutcome(result: { status: number; body: { ok: boolean; code?: string; cache?: { source: string }; access?: { accessTier: string; reason?: string } } }) {
  console.info('[ai-verdict] outcome', {
    status: result.status,
    ok: result.body.ok,
    code: result.body.ok ? null : result.body.code ?? null,
    cacheSource: result.body.ok ? result.body.cache?.source ?? null : null,
    accessTier: result.body.access?.accessTier ?? null,
    quotaReason: result.body.access?.reason ?? null,
    fallbackReason: result.body.ok ? null : result.body.code ?? null,
  });
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

function forwardedIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();

  if (forwardedFor) {
    return forwardedFor;
  }

  return (
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    null
  );
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === '23505');
}

function accessFromCounts({
  accessTier,
  used,
  limit,
  quotaScope,
  quotaBucket,
}: {
  accessTier: AiVerdictAccessState['accessTier'];
  used: number;
  limit: number;
  quotaScope: AiVerdictAccessState['quotaScope'];
  quotaBucket: string | null;
}): AiVerdictAccessState {
  return {
    accessTier,
    allowed: used < limit,
    used: Math.min(used, limit),
    remaining: Math.max(limit - used, 0),
    limit,
    quotaScope,
    quotaBucket,
  };
}

function reservationFailureCode(reason: string | null): Extract<
  AiVerdictUsageReservationResult,
  { ok: false }
>['code'] {
  if (reason === 'global_daily_cap') {
    return 'global_daily_cap_exceeded';
  }

  if (reason === 'ip_daily_cap') {
    return 'ip_daily_cap_exceeded';
  }

  if (reason === 'fair_use') {
    return 'fair_use_exceeded';
  }

  return 'quota_exceeded';
}

async function countAuthenticatedActiveUsage(
  adminClient: ReturnType<typeof createClient>,
  tableName: 'ai_case_verdict_usage_events' | 'ai_deep_read_usage_events',
  userId: string,
  accessTier: 'free' | 'premium',
  quotaBucket: string,
  nowIso: string,
): Promise<number> {
  const [succeededResult, reservedResult] = await Promise.all([
    adminClient
      .from(tableName)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('access_tier', accessTier)
      .eq('quota_bucket', quotaBucket)
      .eq('status', 'succeeded'),
    adminClient
      .from(tableName)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('access_tier', accessTier)
      .eq('quota_bucket', quotaBucket)
      .eq('status', 'reserved')
      .gt('expires_at', nowIso),
  ]);

  if (succeededResult.error || reservedResult.error) {
    throw succeededResult.error ?? reservedResult.error;
  }

  return (succeededResult.count ?? 0) + (reservedResult.count ?? 0);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, code: 'method_not_allowed', message: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')?.trim() ?? '';

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, code: 'unknown', message: 'AI verdict is unavailable right now.' }, 503);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, code: 'unknown', message: 'Invalid request body.' }, 400);
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const token = bearerToken(request);
  const config = aiVerdictConfig();

  const result = await handleAiVerdictRequest(
    token,
    payload,
    {
      modelProvider: MODEL_PROVIDER,
      modelName: MODEL_NAME,
      promptVersion: PROMPT_VERSION,
      responseSchemaVersion: RESPONSE_SCHEMA_VERSION,
      signedInFreeDailyLimit: config.signedInFreeDailyLimit,
      premiumDailyLimit: config.premiumDailyLimit,
      guestLifetimeLimit: config.guestLifetimeLimit,
      guestDailyLimit: config.guestDailyLimit,
      guestIpDailyLimit: config.guestIpDailyLimit,
      globalDailyLimit: config.globalDailyLimit,
      data: {
        async authenticate(authToken) {
          const { data, error } = await authClient.auth.getUser(authToken);
          return error || !data.user ? null : data.user.id;
        },
        async getAuthenticatedAccessTier(userId) {
          const { data } = await adminClient
            .from('premium_states')
            .select('entitlement_status')
            .eq('user_id', userId)
            .maybeSingle();
          const entitlementStatus = (data as PremiumStateRow | null)?.entitlement_status ?? 'free';
          return entitlementStatus === 'premium' || entitlementStatus === 'grace_period' ? 'premium' : 'free';
        },
        async getOwnedActiveCase(userId, caseId) {
          const { data, error } = await adminClient
            .from('cases')
            .select(
              'id,user_id,category,input_text,verdict_label,delusion_score,explanation_text,next_move_text,latest_verdict_version,archived_at,deleted_at',
            )
            .eq('id', caseId)
            .eq('user_id', userId)
            .is('archived_at', null)
            .is('deleted_at', null)
            .maybeSingle();

          if (error) {
            throw error;
          }

          return data ? (data as CaseRow) : null;
        },
        async getCachedVerdict(input: AiVerdictCacheLookupInput) {
          const { data, error } = await adminClient
            .from('ai_case_verdicts')
            .select(
              'id,target_fingerprint,verdict_label,delusion_score,display_label,explanation_text,evidence_check_text,overreading_text,what_matters_text,next_move_text,verdict_version,local_verdict_label,local_delusion_score,local_explanation_text,local_next_move_text,local_verdict_version,model_provider,model_name,model_version,prompt_version,response_schema_version,created_at',
            )
            .eq('user_id', input.userId)
            .eq('case_id', input.caseId)
            .eq('target_fingerprint', input.targetFingerprint)
            .eq('model_provider', input.modelProvider)
            .eq('model_name', input.modelName)
            .eq('prompt_version', input.promptVersion)
            .eq('response_schema_version', input.responseSchemaVersion)
            .maybeSingle();

          if (error) {
            throw error;
          }

          return data ? (data as AiVerdictStoredRow) : null;
        },
        async getCachedGuestVerdict(input: GuestAiVerdictCacheLookupInput) {
          const { data, error } = await adminClient
            .from('ai_guest_case_verdicts')
            .select(
              'id,target_fingerprint,verdict_label,delusion_score,display_label,explanation_text,evidence_check_text,overreading_text,what_matters_text,next_move_text,verdict_version,local_verdict_label,local_delusion_score,local_explanation_text,local_next_move_text,local_verdict_version,model_provider,model_name,model_version,prompt_version,response_schema_version,created_at',
            )
            .eq('guest_key_hash', input.guestKeyHash)
            .eq('target_fingerprint', input.targetFingerprint)
            .eq('model_provider', input.modelProvider)
            .eq('model_name', input.modelName)
            .eq('prompt_version', input.promptVersion)
            .eq('response_schema_version', input.responseSchemaVersion)
            .maybeSingle();

          if (error) {
            throw error;
          }

          return data ? (data as AiVerdictStoredRow) : null;
        },
        async getUsageAccess(input) {
          const nowIso = new Date().toISOString();

          if (input.accessTier === 'guest') {
            let succeededQuery = adminClient
              .from('ai_case_verdict_usage_events')
              .select('id', { count: 'exact', head: true })
              .eq('guest_key_hash', input.guestKeyHash)
              .eq('status', 'succeeded');
            let reservedQuery = adminClient
              .from('ai_case_verdict_usage_events')
              .select('id', { count: 'exact', head: true })
              .eq('guest_key_hash', input.guestKeyHash)
              .eq('status', 'reserved')
              .gt('expires_at', nowIso);

            if (input.quotaScope === 'daily') {
              succeededQuery = succeededQuery.eq('quota_bucket', input.quotaBucket);
              reservedQuery = reservedQuery.eq('quota_bucket', input.quotaBucket);
            }

            const [{ count: succeededCount, error: succeededError }, { count: reservedCount, error: reservedError }] =
              await Promise.all([succeededQuery, reservedQuery]);

            if (succeededError || reservedError) {
              throw succeededError ?? reservedError;
            }

            return accessFromCounts({
              accessTier: 'guest',
              used: (succeededCount ?? 0) + (reservedCount ?? 0),
              limit: input.limit,
              quotaScope: input.quotaScope,
              quotaBucket: input.quotaScope === 'daily' ? input.quotaBucket : null,
            });
          }

          if (!input.userId) {
            throw new Error('Authenticated usage access requires user_id.');
          }

          const [aiVerdictUsed, deepReadUsed] = await Promise.all([
            countAuthenticatedActiveUsage(
              adminClient,
              'ai_case_verdict_usage_events',
              input.userId,
              input.accessTier,
              input.quotaBucket,
              nowIso,
            ),
            countAuthenticatedActiveUsage(
              adminClient,
              'ai_deep_read_usage_events',
              input.userId,
              input.accessTier,
              input.quotaBucket,
              nowIso,
            ),
          ]);

          return accessFromCounts({
            accessTier: input.accessTier,
            used: aiVerdictUsed + deepReadUsed,
            limit: input.limit,
            quotaScope: 'daily',
            quotaBucket: input.quotaBucket,
          });
        },
        async reserveUsage(input: AiVerdictUsageReservationInput) {
          const { data, error } = await adminClient
            .rpc('reserve_ai_case_verdict_usage', {
              p_user_id: input.userId ?? null,
              p_guest_key_hash: input.guestKeyHash ?? null,
              p_ip_hash: input.ipHash ?? null,
              p_access_tier: input.accessTier,
              p_target_fingerprint: input.targetFingerprint,
              p_quota_bucket: input.quotaBucket,
              p_now: input.nowIso,
              p_primary_limit: input.primaryLimit,
              p_guest_lifetime_limit: input.guestLifetimeLimit,
              p_guest_daily_limit: input.guestDailyLimit,
              p_ip_daily_limit: input.ipDailyLimit,
              p_global_daily_limit: input.globalDailyLimit,
            })
            .single();

          if (error || !data) {
            throw error ?? new Error('AI verdict usage reservation returned no data.');
          }

          const row = data as {
            allowed: boolean;
            usage_event_id: string | null;
            used: number;
            remaining: number;
            quota_scope: 'daily' | 'lifetime';
            reason: string | null;
          };
          const access: AiVerdictAccessState = {
            accessTier: input.accessTier,
            allowed: row.allowed,
            used: row.used,
            remaining: row.remaining,
            limit:
              row.reason === 'global_daily_cap'
                ? input.globalDailyLimit
                : row.reason === 'ip_daily_cap'
                  ? input.ipDailyLimit
                  : row.quota_scope === 'daily' && input.accessTier === 'guest'
                    ? input.guestDailyLimit
                    : input.primaryLimit,
            quotaScope: row.quota_scope,
            quotaBucket: row.quota_scope === 'daily' ? input.quotaBucket : null,
            reason: row.reason as AiVerdictAccessState['reason'],
          };

          if (!row.allowed) {
            return {
              ok: false,
              code: reservationFailureCode(row.reason),
              access,
            };
          }

          if (!row.usage_event_id) {
            throw new Error('AI verdict usage reservation did not return an id.');
          }

          return {
            ok: true,
            usageEventId: row.usage_event_id,
            access,
          };
        },
        async finalizeUsageSucceeded({ usageEventId, aiCaseVerdictId, aiGuestCaseVerdictId }) {
          const { error } = await adminClient
            .from('ai_case_verdict_usage_events')
            .update({
              status: 'succeeded',
              ai_case_verdict_id: aiCaseVerdictId ?? null,
              ai_guest_case_verdict_id: aiGuestCaseVerdictId ?? null,
              finalized_at: new Date().toISOString(),
            })
            .eq('id', usageEventId);

          if (error) {
            throw error;
          }
        },
        async finalizeUsageFailed(usageEventId, failureCode) {
          const { error } = await adminClient
            .from('ai_case_verdict_usage_events')
            .update({
              status: 'failed',
              failure_code: failureCode,
              finalized_at: new Date().toISOString(),
            })
            .eq('id', usageEventId);

          if (error) {
            throw error;
          }
        },
        async insertVerdict(input: InsertAuthenticatedAiVerdictInput) {
          const { data, error } = await adminClient
            .from('ai_case_verdicts')
            .insert(input)
            .select(
              'id,target_fingerprint,verdict_label,delusion_score,display_label,explanation_text,evidence_check_text,overreading_text,what_matters_text,next_move_text,verdict_version,local_verdict_label,local_delusion_score,local_explanation_text,local_next_move_text,local_verdict_version,model_provider,model_name,model_version,prompt_version,response_schema_version,created_at',
            )
            .single();

          if (error || !data) {
            throw error ?? new Error('AI verdict insert returned no data.');
          }

          return data as AiVerdictStoredRow;
        },
        async insertGuestVerdict(input: InsertGuestAiVerdictInput) {
          const { data, error } = await adminClient
            .from('ai_guest_case_verdicts')
            .insert(input)
            .select(
              'id,target_fingerprint,verdict_label,delusion_score,display_label,explanation_text,evidence_check_text,overreading_text,what_matters_text,next_move_text,verdict_version,local_verdict_label,local_delusion_score,local_explanation_text,local_next_move_text,local_verdict_version,model_provider,model_name,model_version,prompt_version,response_schema_version,created_at',
            )
            .single();

          if (error || !data) {
            throw error ?? new Error('Guest AI verdict insert returned no data.');
          }

          return data as AiVerdictStoredRow;
        },
        isUniqueViolation,
      },
      generateVerdict: (target) => generateAiVerdictWithGemini(target, geminiApiKey, MODEL_NAME),
    },
    { ipAddress: forwardedIp(request) },
  );

  logAiVerdictOutcome(result);

  return json(result.body, result.status);
});
