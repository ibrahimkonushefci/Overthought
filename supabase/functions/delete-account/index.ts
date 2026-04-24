import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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
    return json({ ok: false, code: 'delete_failed', message: 'Supabase function secrets are missing.' }, 503);
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await authClient.auth.getUser(token);

  if (userError || !userData.user) {
    return json({ ok: false, code: 'not_authenticated', message: 'Invalid auth token.' }, 401);
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userData.user.id);

  if (deleteError) {
    return json(
      {
        ok: false,
        code: 'delete_failed',
        message: deleteError.message,
      },
      500,
    );
  }

  return json({ ok: true });
});
