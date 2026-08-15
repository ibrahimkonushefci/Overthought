const RPC_PATH = '/rest/v1/rpc/keep_supabase_active';
const RETRY_DELAYS_MS = [0, 5_000, 15_000];
const REQUEST_TIMEOUT_MS = 20_000;

function requireBinding(env, name) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required Worker secret: ${name}`);
  }
  return value;
}

function buildRpcUrl(supabaseUrl) {
  const baseUrl = new URL(supabaseUrl);
  if (baseUrl.protocol !== 'https:') {
    throw new Error('SUPABASE_URL must use HTTPS');
  }
  return new URL(RPC_PATH, baseUrl).toString();
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runKeepalive(env, scheduledTime) {
  const supabaseUrl = requireBinding(env, 'SUPABASE_URL');
  const publishableKey = requireBinding(env, 'SUPABASE_PUBLISHABLE_KEY');
  const rpcUrl = buildRpcUrl(supabaseUrl);
  let lastFailure = 'unknown error';

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay > 0) {
      await wait(delay);
    }

    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          apikey: publishableKey,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: '{}',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const body = (await response.text()).trim();

      if (response.ok && body === 'true') {
        console.log('Supabase keepalive succeeded', {
          attempt: attempt + 1,
          scheduledTime: new Date(scheduledTime).toISOString(),
          status: response.status,
        });
        return;
      }

      lastFailure = `HTTP ${response.status} with an unexpected response`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(
    `Supabase keepalive failed after ${RETRY_DELAYS_MS.length} attempts: ${lastFailure}`,
  );
}

export default {
  async scheduled(controller, env) {
    await runKeepalive(env, controller.scheduledTime);
  },
};
