# Deployed free backend — WU staging

API: https://fsosngspvclkgtbszwoc.supabase.co/functions/v1/wu-checkout-staging
Health: https://fsosngspvclkgtbszwoc.supabase.co/functions/v1/wu-checkout-staging/health
Project: https://supabase.com/dashboard/project/fsosngspvclkgtbszwoc
Function: https://supabase.com/dashboard/project/fsosngspvclkgtbszwoc/functions/wu-checkout-staging

The existing empty general project was restored on its existing Free plan. The unrelated photo-sphere project was left untouched. No paid subscription, new Site, Render service or Vercel project was created. Free includes finite quotas and projects can pause after a week without activity; this is not an uptime guarantee for production. See https://supabase.com/pricing and https://supabase.com/docs/guides/functions/limits .

## Architecture and access

Deno Edge Function reuses the existing authoritative catalog and Checkout class. Async storage works with both the original SQLite service and Supabase Postgres RPCs. Orders/events/outbox are in private `wu_staging`, RLS enabled, no anon/authenticated table access. RPCs are SECURITY INVOKER, revoked from PUBLIC/anon/authenticated and granted only to service_role. Built-in server credentials stay inside Supabase; no database key is added to Pages.

JWT verification at the function gateway is disabled because guest Checkout uses its own random order token and webhook requests use a Stripe signature. The function enforces those checks itself. Quote is public for the two allowed storefront origins (the existing domain and http://localhost:3002); status requires the private bearer token. DB-backed route budgets survive cold starts.

This function always forces test mode, irrespective of shared project variables. It reads only the WU_STAGING_* custom secret names in .env.example. It cannot activate Live payments by changing STRIPE_MODE. Live will require a separate function and isolated storage namespace after Sandbox verification.

## Add secrets without chat

Open project > Edge Functions > Secrets:
https://supabase.com/dashboard/project/fsosngspvclkgtbszwoc/functions/secrets

Add the WU_STAGING_* variables from this directory's .env.example. The Stripe key must be rk_test_ from the intended Sandbox; the product and prices must be in that same Sandbox. Use 699 PLN / 160 EUR inclusive one-time prices. The webhook destination is:
https://fsosngspvclkgtbszwoc.supabase.co/functions/v1/wu-checkout-staging/webhook

Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired; signing secret goes in WU_STAGING_STRIPE_WEBHOOK_SECRET. SMTP must support TLS on port 465; Supabase blocks outgoing ports 25 and 587. Actual delivery and Deno/Nodemailer compatibility with the selected SMTP server remain to be tested. Keep CHECKOUT_ENABLED false until that configuration and required Checkout business terms URLs are verified.

The main storefront's checkoutApi stays empty, so the public shop cannot accidentally redirect to Sandbox. For a local staging page, serve the existing branch at http://localhost:3002 and use the API URL above as checkoutApi in a local ignored configuration or temporary local edit. Do not publish Sandbox configuration to the main shop.

## Durable email retry without a new scheduler

On paid webhook, the order/event/outbox transition commits before email delivery. A failed SMTP attempt keeps the outbox row with exponential backoff and returns HTTP 503 to Stripe. Stripe redelivers the event; deduplication prevents a second paid transition, and the mail worker claims queued rows with a five-minute lease (FOR UPDATE SKIP LOCKED). Only the lease owner can mark delivery complete. After sending, webhook returns 200. SMTP itself still cannot guarantee exactly-once delivery across a crash after acceptance.

No background scheduler was installed. An initial cron migration was rejected by automatic safety review because it would create global extensions/scheduled networking and change shared net-schema privileges. It was not applied; that design was removed rather than bypassing the rejection. No worker secret was created. The empty reserved worker_auth table/RPC in the first migration is unused and inaccessible to browser roles.

Retry depends on Stripe's finite webhook retry window; a longer mail outage needs operator replay of the failed Stripe delivery. During Sandbox testing, verify actual retry behavior and Dashboard replay. Do not report this as a separately running cron worker. No synthetic keepalive is used to prevent Free-plan pausing.

## Verified evidence

- 26 local Node tests pass, including the Edge path variants and failure/replay mail flow; Deno type check passes.
- 14 HTTP checks pass against the actual deployed function: connected DB, test mode, payments disabled, PL 728 PLN and DE 179 EUR final totals, CORS/preflight, unsupported US/FR, unconfirmed packing, amount/size/body injection, invalid origin, forged webhook and unauthorized order lookup.
- Real Postgres transactional self-test (rolled back) verifies create/attach, event deduplication, monotonic paid, one outbox row, exclusive mail lease and lease-owner completion. Zero test orders/events/outbox rows persist.
- DB grants checked: anon/authenticated cannot execute order RPC; anon cannot read orders; service_role can execute. Security advisor returned only INFO notices for RLS without policies, intentionally no browser access; no warning/error findings.
- No actual Stripe Sandbox payment, Live payment or SMTP delivery has passed. Checkout is disabled. Site and current Pages deployment remain unchanged.

Re-run local checks: npm run check && npm test.
HTTP smoke: python3 backend/test/deployed-smoke.py https://fsosngspvclkgtbszwoc.supabase.co/functions/v1/wu-checkout-staging
Deno: DENO_DIR=/private/tmp/wu-deno-cache npm exec --yes --cache /private/tmp/wu-npm-cache --package=deno -- deno check --config backend/supabase/deno.json backend/supabase/index.ts

Deploy uses the connected Supabase deploy_edge_function tool and uploads index.ts, deno.json, store.mjs, handler.mjs, policy.mjs plus backend/catalog.mjs, checkout.mjs and mail.mjs. Regenerate policy.mjs from policies.txt when policies change. Secrets are not part of the upload.
