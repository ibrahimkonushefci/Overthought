import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { handleDeleteGuestDataRequest } from './core.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, code: 'method_not_allowed', message: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, code: 'delete_failed', message: 'Supabase function secrets are missing.' }, 503);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, code: 'invalid_guest_key', message: 'Invalid request body.' }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const result = await handleDeleteGuestDataRequest(payload, {
    data: {
      async deleteGuestVerdicts(guestKeyHash) {
        const { error } = await adminClient
          .from('ai_guest_case_verdicts')
          .delete()
          .eq('guest_key_hash', guestKeyHash);

        if (error) {
          throw error;
        }
      },
      async deleteGuestUsageEvents(guestKeyHash) {
        const { error } = await adminClient
          .from('ai_case_verdict_usage_events')
          .delete()
          .eq('guest_key_hash', guestKeyHash);

        if (error) {
          throw error;
        }
      },
    },
  });

  return json(result.body, result.status);
});
