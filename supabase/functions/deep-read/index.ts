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
  | 'ai_timeout'
  | 'ai_failed'
  | 'invalid_ai_response'
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

type ProviderFailureCode = 'ai_timeout' | 'ai_failed' | 'invalid_ai_response';

type DeepReadProviderResult =
  | {
      ok: true;
      deepRead: DeepReadOutput;
      modelVersion: string | null;
    }
  | {
      ok: false;
      code: ProviderFailureCode;
    };

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  modelVersion?: string;
}

interface GeminiErrorResponse {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

const MODEL_PROVIDER = 'gemini';
const MODEL_NAME = 'gemini-2.5-flash';
const PROMPT_VERSION = 1;
const RESPONSE_SCHEMA_VERSION = 1;
const FREE_DAILY_LIMIT = 2;
const PREMIUM_DAILY_FAIR_USE_LIMIT = 100;
const GEMINI_TIMEOUT_MS = 12_000;
const DEEP_READ_FIELD_LIMITS = {
  whatsActuallyHappening: 210,
  whatYoureOverreading: 220,
  whatEvidenceActuallyMatters: 210,
  whatToDoNext: 180,
  roastLine: 100,
} as const;

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
  used: number | null,
  quotaBucket: string,
  allowed = true,
  reason?: 'daily_limit' | 'fair_use',
) {
  const limit = accessTier === 'premium' ? PREMIUM_DAILY_FAIR_USE_LIMIT : FREE_DAILY_LIMIT;

  return {
    accessTier,
    allowed,
    remaining: used === null ? null : Math.max(limit - used, 0),
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

function geminiUrl(apiKey: string): string {
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`);
  url.searchParams.set('key', apiKey);
  return url.toString();
}

function logDeepReadDiagnostic(event: string, details: Record<string, unknown> = {}) {
  console.info(`[deep-read] ${event}`, details);
}

function sanitizeProviderMessage(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const sanitized = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return sanitized ? sanitized.slice(0, 180) : null;
}

async function readGeminiError(response: Response) {
  const body = await response.text();
  const bodyLength = body.length;

  try {
    const parsed = JSON.parse(body) as GeminiErrorResponse;
    return {
      bodyLength,
      errorCode: parsed.error?.code ?? null,
      errorStatus: parsed.error?.status ?? null,
      errorMessage: sanitizeProviderMessage(parsed.error?.message),
    };
  } catch {
    return {
      bodyLength,
      errorCode: null,
      errorStatus: null,
      errorMessage: null,
    };
  }
}

function deepReadJsonSchema() {
  const stringField = (description: string) => ({
    type: 'string',
    description,
  });

  return {
    type: 'object',
    properties: {
      whatsActuallyHappening: stringField(
        'A blunt, funny read of what the situation most likely means. Short, concrete, group-chat direct.',
      ),
      whatYoureOverreading: stringField(
        'The fantasy, assumption, or fake storyline being added without enough evidence. Roast the overthinking, not the user.',
      ),
      whatEvidenceActuallyMatters: stringField(
        'The real receipts that matter most. Separate actual behavior from crumbs, vibes, screenshots, and imaginary plot.',
      ),
      whatToDoNext: stringField(
        'One practical next move. Short, useful, grounded in the local verdict, and never therapy-coded or corporate.',
      ),
      roastLine: stringField(
        'The most quotable screenshot line. Savage, meme-aware, slightly rude, but not hateful, sexual, or cruel.',
      ),
    },
    required: [
      'whatsActuallyHappening',
      'whatYoureOverreading',
      'whatEvidenceActuallyMatters',
      'whatToDoNext',
      'roastLine',
    ],
  };
}

function buildDeepReadPrompt(row: CaseRow): string {
  return `You are Deep Read, an AI enrichment layer for Overthought.

  The deterministic local verdict is canonical. Do not override it, recalculate it, rename it, or imply that it is wrong. Your job is to explain the situation more richly underneath that verdict.

  Return only valid JSON matching the requested schema. No markdown. No extra keys.

  Tone:
  - Funny-first, useful second.
  - Write like the funniest person in the group chat who is still correct.
  - Brutally honest and group-chat savage.
  - sharp, direct, meme-aware, and punchy
  - slightly rude, like a best friend who is tired of hearing the same delusion
  - useful, but make it sting a little
  - not therapist-like, not corporate, not generic AI assistant
  - Use plain language, not advice-column language.
  - no long explanations, no soft hedging, no emotional hand-holding
  - roast the overthinking and the weak evidence, not the user's identity or worth
  - be savage about the situation, not hateful toward the person
  - do not use slurs, hate, sexual insults, threats, self-harm language, or mental-health diagnosis language
  - do not call the user crazy, stupid, pathetic, worthless, or similar personal attacks
  - the vibe is: rude best friend with receipts, not bully

  Style rules:
  - Be sharper and funnier than the local verdict.
  - Use short, memorable lines.
  - Write for a phone screenshot.
  - No paragraph energy.
  - Each field should feel like a punchline with a point.
  - Prefer one sentence per field unless two are truly needed.
  - Use short sentences. Avoid long comma chains.
  - At least 2 fields should include a vivid metaphor or memorable line.
  - Every field must reference concrete case details when possible.
  - Prefer concrete phrases like crumbs, receipts, vibes, plot, screenshot, soft launch, situationship.
  - Prefer concrete brutal clarity over gentle reassurance.
  - Avoid therapy language like "valid", "validate", "process", "hold space", "anxious attachment", "trauma response".
  - Avoid corporate language like "it may be beneficial", "consider evaluating", "communication pattern", "interpersonal dynamic".
  - Also avoid: "It sounds like", "It seems", "consider", "communicate openly", "interpersonal dynamic", "non-committal language".
  - Do not hedge too much. No "maybe", "possibly", "it seems" unless truly needed.
  - Do not over-explain.
  - Do not repeat the same metaphor pattern across fields.
  - Do not overuse "your brain is...". Use it rarely.
  - Cut filler before returning JSON.
  - Use occasional meme/group-chat phrasing, but do not overdo slang.
  - The roastLine must be the most savage and screenshot-worthy line.

  Replacement style:
  - Instead of "consider this conversation closed," prefer "until there's a plan, don't build a plot."
  - Instead of "non-committal language," prefer "sometime is fog with punctuation."
  - Instead of "communicate your needs," prefer "ask once, clearly, then stop refreshing the evidence."

  Length:
  - whatsActuallyHappening: prefer 1 sentence; 2 only if needed, max ${DEEP_READ_FIELD_LIMITS.whatsActuallyHappening} characters.
  - whatYoureOverreading: prefer 1 sentence; 2 only if needed, max ${DEEP_READ_FIELD_LIMITS.whatYoureOverreading} characters.
  - whatEvidenceActuallyMatters: prefer 1 sentence; 2 only if needed, max ${DEEP_READ_FIELD_LIMITS.whatEvidenceActuallyMatters} characters.
  - whatToDoNext: 1 direct practical instruction, max ${DEEP_READ_FIELD_LIMITS.whatToDoNext} characters.
  - roastLine: 1 punchy line only, max ${DEEP_READ_FIELD_LIMITS.roastLine} characters.

  Target style examples:
  - "A story view is not a confession."
  - "That is a crumb, not a contract."
  - "Your brain is building a Netflix series from a notification."
  - "Sometimes is not a day of the week."
  - "This is not a signal. This is WiFi noise."
  - "You are trying to turn a polite maybe into a legally binding romance arc."
  - "The evidence is wearing a fake mustache and calling itself proof."
  - "There is no plan here, just vibes in a trench coat."
  - "This is less hidden meaning and more you needing a hobby for the next 12 minutes."
  - "The group chat would confiscate your phone for this."

  Local canonical verdict:
  ${JSON.stringify(
    {
      targetType: 'case',
      category: row.category,
      localVerdictLabel: row.verdict_label,
      localDelusionScore: row.delusion_score,
      localVerdictVersion: row.latest_verdict_version,
    },
    null,
    2,
)}

Untrusted case text:
${JSON.stringify(row.input_text)}`;
}

function sanitizeDeepReadOutput(value: DeepReadOutput): DeepReadOutput {
  return {
    whatsActuallyHappening: value.whatsActuallyHappening
      .trim()
      .slice(0, DEEP_READ_FIELD_LIMITS.whatsActuallyHappening),
    whatYoureOverreading: value.whatYoureOverreading.trim().slice(0, DEEP_READ_FIELD_LIMITS.whatYoureOverreading),
    whatEvidenceActuallyMatters: value.whatEvidenceActuallyMatters
      .trim()
      .slice(0, DEEP_READ_FIELD_LIMITS.whatEvidenceActuallyMatters),
    whatToDoNext: value.whatToDoNext.trim().slice(0, DEEP_READ_FIELD_LIMITS.whatToDoNext),
    roastLine: value.roastLine.trim().slice(0, DEEP_READ_FIELD_LIMITS.roastLine),
  };
}

function extractGeminiText(value: GeminiGenerateContentResponse): string | null {
  return value.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text ?? null;
}

function parseDeepReadJson(value: string): DeepReadProviderResult {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!isValidDeepReadOutput(parsed)) {
      logDeepReadDiagnostic('deep_read_gemini_output_validation_failed', {
        responseTextLength: value.length,
      });
      return { ok: false, code: 'invalid_ai_response' };
    }

    const sanitized = sanitizeDeepReadOutput(parsed);
    if (!isValidDeepReadOutput(sanitized)) {
      logDeepReadDiagnostic('deep_read_gemini_output_validation_failed', {
        responseTextLength: value.length,
      });
      return { ok: false, code: 'invalid_ai_response' };
    }

    return {
      ok: true,
      deepRead: sanitized,
      modelVersion: null,
    };
  } catch {
    logDeepReadDiagnostic('deep_read_gemini_output_json_parse_failed', {
      responseTextLength: value.length,
    });
    return { ok: false, code: 'invalid_ai_response' };
  }
}

async function generateDeepRead(row: CaseRow, apiKey: string): Promise<DeepReadProviderResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  logDeepReadDiagnostic('deep_read_gemini_start', {
    hasGeminiApiKey: Boolean(apiKey),
    modelName: MODEL_NAME,
  });

  try {
    const response = await fetch(geminiUrl(apiKey), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildDeepReadPrompt(row) }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 900,
          responseMimeType: 'application/json',
          responseJsonSchema: deepReadJsonSchema(),
        },
      }),
    });

    if (!response.ok) {
      const providerError = await readGeminiError(response);
      logDeepReadDiagnostic('deep_read_gemini_non_2xx', {
        httpStatus: response.status,
        modelName: MODEL_NAME,
        providerErrorCode: providerError.errorCode,
        providerErrorStatus: providerError.errorStatus,
        providerErrorMessage: providerError.errorMessage,
        bodyLength: providerError.bodyLength,
      });
      return { ok: false, code: 'ai_failed' };
    }

    let responseJson: GeminiGenerateContentResponse;

    try {
      responseJson = (await response.json()) as GeminiGenerateContentResponse;
    } catch {
      logDeepReadDiagnostic('deep_read_gemini_response_json_failed', {
        httpStatus: response.status,
        modelName: MODEL_NAME,
      });
      return { ok: false, code: 'invalid_ai_response' };
    }

    const text = extractGeminiText(responseJson);

    if (!text) {
      logDeepReadDiagnostic('deep_read_gemini_missing_candidate_text', {
        modelName: MODEL_NAME,
        candidateCount: responseJson.candidates?.length ?? 0,
      });
      return { ok: false, code: 'invalid_ai_response' };
    }

    const parsed = parseDeepReadJson(text);

    if (!parsed.ok) {
      return parsed;
    }

    logDeepReadDiagnostic('deep_read_gemini_success', {
      modelName: MODEL_NAME,
      responseTextLength: text.length,
      modelVersionPresent: typeof responseJson.modelVersion === 'string',
    });

    return {
      ok: true,
      deepRead: parsed.deepRead,
      modelVersion: typeof responseJson.modelVersion === 'string' ? responseJson.modelVersion : null,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      logDeepReadDiagnostic('deep_read_gemini_timeout', {
        modelName: MODEL_NAME,
        timeoutMs: GEMINI_TIMEOUT_MS,
      });
      return { ok: false, code: 'ai_timeout' };
    }

    logDeepReadDiagnostic('deep_read_gemini_fetch_failed', {
      modelName: MODEL_NAME,
      errorName: error instanceof Error ? error.name : 'unknown',
      errorMessage: sanitizeProviderMessage(error instanceof Error ? error.message : null),
    });
    return { ok: false, code: 'ai_failed' };
  } finally {
    clearTimeout(timeout);
  }
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

async function finalizeUsageSucceeded(
  adminClient: ReturnType<typeof createClient>,
  usageEventId: string,
  deepReadId: string,
) {
  return adminClient
    .from('ai_deep_read_usage_events')
    .update({
      status: 'succeeded',
      ai_deep_read_id: deepReadId,
      finalized_at: new Date().toISOString(),
    })
    .eq('id', usageEventId);
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === '23505');
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
    return json({ ok: false, code: 'unknown', message: 'Deep Read is unavailable right now.' }, 503);
  }

  let payload: DeepReadCaseRequest;

  try {
    payload = (await request.json()) as DeepReadCaseRequest;
  } catch {
    return json({ ok: false, code: 'unknown', message: 'Invalid request body.' }, 400);
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

    if (cachedData) {
      return json(cacheResponse(cachedData as DeepReadRow, accessState(accessTier, null, quotaBucket)));
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')?.trim() ?? '';

    logDeepReadDiagnostic('deep_read_gemini_secret_checked', {
      hasGeminiApiKey: Boolean(geminiApiKey),
      modelName: MODEL_NAME,
    });

    if (!geminiApiKey) {
      logDeepReadDiagnostic('deep_read_gemini_missing_secret', {
        hasGeminiApiKey: false,
        modelName: MODEL_NAME,
      });
      return json({ ok: false, code: 'ai_failed', message: 'Unable to generate Deep Read right now.' }, 503);
    }

    const nowIso = new Date().toISOString();
    const { count: succeededCount, error: succeededCountError } = await adminClient
      .from('ai_deep_read_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('access_tier', accessTier)
      .eq('quota_bucket', quotaBucket)
      .eq('status', 'succeeded');

    if (succeededCountError) {
      throw succeededCountError;
    }

    const { count: reservedCount, error: reservedCountError } = await adminClient
      .from('ai_deep_read_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('access_tier', accessTier)
      .eq('quota_bucket', quotaBucket)
      .eq('status', 'reserved')
      .gt('expires_at', nowIso);

    if (reservedCountError) {
      throw reservedCountError;
    }

    const used = (succeededCount ?? 0) + (reservedCount ?? 0);
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

    const reservedUsageEventId = (usageData as UsageEventRow).id;
    usageEventId = reservedUsageEventId;

    const providerResult = await generateDeepRead(caseRow, geminiApiKey);

    if (!providerResult.ok) {
      await finalizeUsageFailed(adminClient, reservedUsageEventId, providerResult.code);

      if (providerResult.code === 'ai_timeout') {
        return json({ ok: false, code: 'ai_timeout', message: 'Deep Read timed out. Try again.' }, 504);
      }

      if (providerResult.code === 'invalid_ai_response') {
        return json(
          { ok: false, code: 'invalid_ai_response', message: 'Deep Read returned an invalid response.' },
          502,
        );
      }

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
        model_version: providerResult.modelVersion,
        prompt_version: PROMPT_VERSION,
        response_schema_version: RESPONSE_SCHEMA_VERSION,
        response_json: providerResult.deepRead,
      })
      .select(
        'id,target_type,target_fingerprint,model_provider,model_name,model_version,prompt_version,response_schema_version,response_json,created_at',
      )
      .single();

    if (cacheWriteError || !insertedCacheData) {
      if (isUniqueViolation(cacheWriteError)) {
        const { data: racedCacheData, error: racedCacheLookupError } = await adminClient
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

        if (racedCacheLookupError) {
          await finalizeUsageFailed(adminClient, reservedUsageEventId, 'cache_write_failed');
          return json({ ok: false, code: 'cache_write_failed', message: 'Unable to cache Deep Read right now.' }, 500);
        }

        if (racedCacheData) {
          const { error: usageFinalizeError } = await finalizeUsageSucceeded(
            adminClient,
            reservedUsageEventId,
            (racedCacheData as DeepReadRow).id,
          );

          if (usageFinalizeError) {
            await finalizeUsageFailed(adminClient, reservedUsageEventId, 'unknown');
            return json({ ok: false, code: 'unknown', message: 'Deep Read is unavailable right now.' }, 500);
          }

          return json(cacheResponse(racedCacheData as DeepReadRow, accessState(accessTier, used + 1, quotaBucket)));
        }
      }

      await finalizeUsageFailed(adminClient, reservedUsageEventId, 'cache_write_failed');
      return json({ ok: false, code: 'cache_write_failed', message: 'Unable to cache Deep Read right now.' }, 500);
    }

    const { error: usageFinalizeError } = await finalizeUsageSucceeded(
      adminClient,
      reservedUsageEventId,
      (insertedCacheData as DeepReadRow).id,
    );

    if (usageFinalizeError) {
      await finalizeUsageFailed(adminClient, reservedUsageEventId, 'unknown');
      return json({ ok: false, code: 'unknown', message: 'Deep Read is unavailable right now.' }, 500);
    }

    return json(generatedResponse(insertedCacheData as DeepReadRow, accessState(accessTier, used + 1, quotaBucket)));
  } catch {
    await finalizeUsageFailed(adminClient, usageEventId, 'unknown');
    return json(
      {
        ok: false,
        code: 'unknown',
        message: 'Deep Read is unavailable right now.',
      },
      500,
    );
  }
});
