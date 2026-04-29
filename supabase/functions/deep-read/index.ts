import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type CaseCategory = 'romance' | 'friendship' | 'social' | 'general';
type VerdictLabel =
  | 'barely_delusional'
  | 'slight_reach'
  | 'mild_delusion'
  | 'dangerous_overthinking'
  | 'full_clown_territory';
type EntitlementStatus = 'free' | 'premium' | 'grace_period' | 'expired';
type DeepReadAccessTier = 'free' | 'premium';
type DeepReadFailureCode =
  | 'not_authenticated'
  | 'case_not_found'
  | 'quota_exceeded'
  | 'fair_use_exceeded'
  | 'ai_failed'
  | 'cache_write_failed'
  | 'unknown';

interface DeepReadCaseRequest {
  target?: {
    targetType?: 'case';
    caseId?: string;
  };
}

interface CaseRow {
  id: string;
  user_id: string;
  category: CaseCategory;
  input_text: string;
  verdict_label: VerdictLabel;
  delusion_score: number;
  latest_verdict_version: number;
  archived_at: string | null;
  deleted_at: string | null;
}

interface PremiumStateRow {
  entitlement_status: EntitlementStatus;
}

interface DeepReadOutput {
  whatsActuallyHappening: string;
  whatYoureOverreading: string;
  whatEvidenceActuallyMatters: string;
  whatToDoNext: string;
  roastLine: string;
}

interface DeepReadRow {
  id: string;
  target_type: 'case';
  target_fingerprint: string;
  model_provider: string;
  model_name: string;
  model_version: string | null;
  prompt_version: number;
  response_schema_version: number;
  response_json: DeepReadOutput;
  created_at: string;
}

interface UsageEventRow {
  id: string;
}

const MODEL_PROVIDER = 'stub';
const MODEL_NAME = 'deep-read-stub';
const MODEL_VERSION: string | null = null;
const PROMPT_VERSION = 1;
const RESPONSE_SCHEMA_VERSION = 1;
const FREE_DAILY_LIMIT = 2;
const PREMIUM_DAILY_FAIR_USE_LIMIT = 100;

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

function todayUtcBucket(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeInputText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function canonicalJson(value: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = value[key];
        return result;
      }, {}),
  );
}

async function fingerprintCase(row: CaseRow): Promise<string> {
  return sha256Hex(
    canonicalJson({
      category: row.category,
      inputText: normalizeInputText(row.input_text),
      localDelusionScore: row.delusion_score,
      localVerdictLabel: row.verdict_label,
      localVerdictVersion: row.latest_verdict_version,
      targetType: 'case',
    }),
  );
}

function accessState(
  accessTier: DeepReadAccessTier,
  used: number,
  quotaBucket: string,
  allowed = true,
  reason?: 'daily_limit' | 'fair_use',
) {
  const limit = accessTier === 'premium' ? PREMIUM_DAILY_FAIR_USE_LIMIT : FREE_DAILY_LIMIT;

  return {
    accessTier,
    allowed,
    remaining: Math.max(limit - used, 0),
    limit,
    quotaBucket,
    reason,
  };
}

function cacheResponse(row: DeepReadRow, access: ReturnType<typeof accessState>) {
  return {
    ok: true,
    deepRead: row.response_json,
    cache: {
      id: row.id,
      source: 'cache',
      targetType: row.target_type,
      targetFingerprint: row.target_fingerprint,
      modelProvider: row.model_provider,
      modelName: row.model_name,
      modelVersion: row.model_version,
      promptVersion: row.prompt_version,
      responseSchemaVersion: row.response_schema_version,
      createdAt: row.created_at,
    },
    access,
  };
}

function generatedResponse(row: DeepReadRow, access: ReturnType<typeof accessState>) {
  return {
    ...cacheResponse(row, access),
    cache: {
      ...cacheResponse(row, access).cache,
      source: 'generated',
    },
  };
}

async function generateDeepReadStub(row: CaseRow): Promise<DeepReadOutput> {
  // TODO: Replace this stub with Gemini 2.5 Flash in a later phase. Keep provider calls
  // behind this function so key handling, retries, timeouts, and JSON validation stay isolated.
  const scoreBand =
    row.delusion_score >= 80
      ? 'thin'
      : row.delusion_score >= 55
        ? 'mixed'
        : row.delusion_score >= 30
          ? 'somewhat grounded'
          : 'fairly grounded';

  return {
    whatsActuallyHappening: `Stub Deep Read: this ${row.category} case currently looks ${scoreBand} based on the local verdict.`,
    whatYoureOverreading:
      'Stub Deep Read: the likely overread is treating ambiguous social evidence as more conclusive than it is.',
    whatEvidenceActuallyMatters:
      'Stub Deep Read: concrete follow-through, direct language, and repeated effort matter more than isolated vibes.',
    whatToDoNext:
      'Stub Deep Read: keep the local verdict visible, wait for clearer evidence, and avoid escalating from this read alone.',
    roastLine: 'Stub Deep Read: the group chat would ask for one real receipt.',
  };
}

function isValidDeepReadOutput(value: unknown): value is DeepReadOutput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const output = value as Record<string, unknown>;
  return [
    output.whatsActuallyHappening,
    output.whatYoureOverreading,
    output.whatEvidenceActuallyMatters,
    output.whatToDoNext,
    output.roastLine,
  ].every((item) => typeof item === 'string' && item.trim().length > 0);
}

async function finalizeUsageFailed(
  adminClient: ReturnType<typeof createClient>,
  usageEventId: string | null,
  failureCode: DeepReadFailureCode,
) {
  if (!usageEventId) {
    return;
  }

  await adminClient
    .from('ai_deep_read_usage_events')
    .update({
      status: 'failed',
      failure_code: failureCode,
      finalized_at: new Date().toISOString(),
    })
    .eq('id', usageEventId);
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

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, code: 'unknown', message: 'Supabase function secrets are missing.' }, 503);
  }

  let payload: DeepReadCaseRequest;

  try {
    payload = (await request.json()) as DeepReadCaseRequest;
  } catch {
    return json({ ok: false, code: 'unknown', message: 'Invalid JSON body.' }, 400);
  }

  if (payload.target?.targetType !== 'case' || !payload.target.caseId) {
    return json({ ok: false, code: 'case_not_found', message: 'Case not found.' }, 400);
  }

  // TODO: Guest Deep Read support needs a later product/schema decision. The current
  // schema cannot record successful guest usage while keeping generated guest output
  // local-only, so this skeleton is authenticated-only.
  const authClient = createClient(supabaseUrl, anonKey);
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await authClient.auth.getUser(token);

  if (userError || !userData.user) {
    return json({ ok: false, code: 'not_authenticated', message: 'Invalid auth token.' }, 401);
  }

  const userId = userData.user.id;
  const quotaBucket = todayUtcBucket();
  let usageEventId: string | null = null;

  try {
    const { data: caseData, error: caseError } = await adminClient
      .from('cases')
      .select('id,user_id,category,input_text,verdict_label,delusion_score,latest_verdict_version,archived_at,deleted_at')
      .eq('id', payload.target.caseId)
      .eq('user_id', userId)
      .is('archived_at', null)
      .is('deleted_at', null)
      .maybeSingle();

    if (caseError) {
      throw caseError;
    }

    if (!caseData) {
      return json({ ok: false, code: 'case_not_found', message: 'Case not found.' }, 404);
    }

    const caseRow = caseData as CaseRow;
    const targetFingerprint = await fingerprintCase(caseRow);

    const { data: cachedData, error: cacheLookupError } = await adminClient
      .from('ai_deep_reads')
      .select(
        'id,target_type,target_fingerprint,model_provider,model_name,model_version,prompt_version,response_schema_version,response_json,created_at',
      )
      .eq('user_id', userId)
      .eq('target_type', 'case')
      .eq('target_fingerprint', targetFingerprint)
      .eq('model_provider', MODEL_PROVIDER)
      .eq('model_name', MODEL_NAME)
      .eq('prompt_version', PROMPT_VERSION)
      .eq('response_schema_version', RESPONSE_SCHEMA_VERSION)
      .maybeSingle();

    if (cacheLookupError) {
      throw cacheLookupError;
    }

    const { data: premiumData } = await adminClient
      .from('premium_states')
      .select('entitlement_status')
      .eq('user_id', userId)
      .maybeSingle();

    const entitlementStatus = (premiumData as PremiumStateRow | null)?.entitlement_status ?? 'free';
    const accessTier: DeepReadAccessTier =
      entitlementStatus === 'premium' || entitlementStatus === 'grace_period' ? 'premium' : 'free';

    const { count, error: usageCountError } = await adminClient
      .from('ai_deep_read_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('access_tier', accessTier)
      .eq('quota_bucket', quotaBucket)
      .eq('status', 'succeeded');

    if (usageCountError) {
      throw usageCountError;
    }

    const used = count ?? 0;
    const cacheAccess = accessState(accessTier, used, quotaBucket);

    if (cachedData) {
      return json(cacheResponse(cachedData as DeepReadRow, cacheAccess));
    }

    const limit = accessTier === 'premium' ? PREMIUM_DAILY_FAIR_USE_LIMIT : FREE_DAILY_LIMIT;

    if (used >= limit) {
      const reason = accessTier === 'premium' ? 'fair_use' : 'daily_limit';
      return json(
        {
          ok: false,
          code: accessTier === 'premium' ? 'fair_use_exceeded' : 'quota_exceeded',
          message:
            accessTier === 'premium'
              ? 'Deep Read is temporarily limited for fair use.'
              : 'Daily Deep Reads are used up.',
          access: accessState(accessTier, used, quotaBucket, false, reason),
        },
        429,
      );
    }

    const { data: usageData, error: usageInsertError } = await adminClient
      .from('ai_deep_read_usage_events')
      .insert({
        user_id: userId,
        access_tier: accessTier,
        target_type: 'case',
        target_fingerprint: targetFingerprint,
        quota_bucket: quotaBucket,
        status: 'reserved',
      })
      .select('id')
      .single();

    if (usageInsertError || !usageData) {
      throw usageInsertError ?? new Error('Usage reservation returned no data.');
    }

    usageEventId = (usageData as UsageEventRow).id;

    const deepRead = await generateDeepReadStub(caseRow);

    if (!isValidDeepReadOutput(deepRead)) {
      await finalizeUsageFailed(adminClient, usageEventId, 'ai_failed');
      return json({ ok: false, code: 'ai_failed', message: 'Unable to generate Deep Read right now.' }, 502);
    }

    const { data: insertedCacheData, error: cacheWriteError } = await adminClient
      .from('ai_deep_reads')
      .insert({
        user_id: userId,
        case_id: caseRow.id,
        target_type: 'case',
        target_fingerprint: targetFingerprint,
        category: caseRow.category,
        local_verdict_label: caseRow.verdict_label,
        local_delusion_score: caseRow.delusion_score,
        local_verdict_version: caseRow.latest_verdict_version,
        model_provider: MODEL_PROVIDER,
        model_name: MODEL_NAME,
        model_version: MODEL_VERSION,
        prompt_version: PROMPT_VERSION,
        response_schema_version: RESPONSE_SCHEMA_VERSION,
        response_json: deepRead,
      })
      .select(
        'id,target_type,target_fingerprint,model_provider,model_name,model_version,prompt_version,response_schema_version,response_json,created_at',
      )
      .single();

    if (cacheWriteError || !insertedCacheData) {
      await finalizeUsageFailed(adminClient, usageEventId, 'cache_write_failed');
      return json({ ok: false, code: 'cache_write_failed', message: 'Unable to cache Deep Read right now.' }, 500);
    }

    const { error: usageFinalizeError } = await adminClient
      .from('ai_deep_read_usage_events')
      .update({
        status: 'succeeded',
        ai_deep_read_id: (insertedCacheData as DeepReadRow).id,
        finalized_at: new Date().toISOString(),
      })
      .eq('id', usageEventId);

    if (usageFinalizeError) {
      await finalizeUsageFailed(adminClient, usageEventId, 'unknown');
      return json({ ok: false, code: 'unknown', message: 'Unable to finalize Deep Read usage.' }, 500);
    }

    return json(generatedResponse(insertedCacheData as DeepReadRow, accessState(accessTier, used + 1, quotaBucket)));
  } catch (error) {
    await finalizeUsageFailed(adminClient, usageEventId, 'unknown');
    return json(
      {
        ok: false,
        code: 'unknown',
        message: error instanceof Error ? error.message : 'Unable to complete Deep Read.',
      },
      500,
    );
  }
});
