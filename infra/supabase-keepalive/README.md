# Supabase Free keepalive

This scheduled-only Cloudflare Worker calls `public.keep_supabase_active()` four
times per day. The RPC returns the constant `true`; it does not read or write
Overthought user data.

## One-time setup

1. Resume the Supabase project if it is currently paused.
2. Apply `supabase/migrations/0008_supabase_keepalive.sql` through the normal
   migration process (`npx supabase db push`) or paste it into the Supabase SQL
   Editor and run it once.
3. In Supabase, open the project's **Connect** dialog or **Settings > API Keys**.
   Copy the Project URL and a publishable key (`sb_publishable_...`). Do not use
   a secret key, legacy `service_role` key, database password, or personal token.
4. From this directory, authenticate and deploy the Worker:

   ```sh
   npx --yes wrangler@latest login --use-keyring
   npx --yes wrangler@latest deploy
   ```

5. Add the values interactively as encrypted Worker secrets:

   ```sh
   npx --yes wrangler@latest secret put SUPABASE_URL
   npx --yes wrangler@latest secret put SUPABASE_PUBLISHABLE_KEY
   ```

   Each command prompts for the value without placing it in source control.
   The second command deploys the final version with both secrets available.

## Verification

Test the RPC directly after applying the migration:

```sh
curl --fail-with-body --silent --show-error \
  --request POST \
  --header "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  --header "content-type: application/json" \
  --data '{}' \
  "$SUPABASE_URL/rest/v1/rpc/keep_supabase_active"
```

The response must be exactly `true`.

After deployment, confirm that Cloudflare lists one Cron Trigger with four daily
invocations at 02:17, 08:17, 14:17, and 20:17 UTC. In **Workers & Pages >
overthought-supabase-keepalive > Observability**, each invocation should be
successful and include `Supabase keepalive succeeded`. Failed requests are
retried twice and then recorded as a failed invocation with an exception.

Cron Trigger changes can take several minutes to propagate. Keep Supabase's
project-pause warning emails enabled; no Free-plan workaround is an uptime SLA.
