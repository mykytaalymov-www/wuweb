# WU? RROSE release audit — 2026-11-11

**Implementation is staged in existing PR #6 / feature/stripe-live-checkout-staging. Supabase Free staging API is deployed; storefront/Live are not deployed. Live payments have not been tested.**

## Verified external state

- GitHub Pages main: `e350c65abfae51458f2843014cd4b6b7aa3dac9f`. Last successful Pages run: https://github.com/mykytaalymov-www/wuweb/actions/runs/40850651288 (2026-10-29).
- `https://wuisthequestion.com` returns HTTP 200 from GitHub.com. Its current product-config still contains the original Sandbox Payment Link and demo delivery rates. Existing main also contains unsafe `?paid` confirmation; this branch removes it.
- Stripe account WU?: `acct_1URD6xHv7Ryf9QPa`, only Live exposed by the connected Stripe tool.
- Existing active product `prod_VbTxAjvibHelD7`, RROSE, shippable, clothing tax code `txcd_30011000`.
- `price_1UaGzgHv7Ryf9QPajobbmb7t`: active, Live, PLN 69900 minor units, inclusive, one-time.
- `price_1UaGziHv7Ryf9QPa2wcb62JL`: active, Live, EUR 16000 minor units, inclusive, one-time.
- No new products, prices or payment links were created.
- No webhook endpoints. Stripe Tax Settings active; registrations list empty. Automatic Tax remains disabled; this does not remove the merchant's VAT reporting obligations.

## Payment Link audit

All five links were read along with line items, allowed countries, required size dropdown, phone/address collection and tax settings. Shipping is already a line item on these links: do not add it a second time.

| Group | Existing link ID | Product + delivery | Current action |
| --- | --- | --- | --- |
| PL | `plink_1UaHLiHv7Ryf9QPa8nqUnJBx` | 699 + 29 = 728 PLN | Preserved; new storefront does not use links |
| DE | `plink_1UaHLlHv7Ryf9QPaTXFLiPFs` | 160 + 19 = 179 EUR | Preserved; new storefront does not use links |
| EU | `plink_1UaJ5dHv7Ryf9QPaVGBWDakX` | 160 + 49 = 209 EUR | Deactivated; unapproved tariff |
| GB/NO/CH | `plink_1UaJ5kHv7Ryf9QPax4GchZpo` | 160 + 99 = 259 EUR | Deactivated; unapproved tariff |
| Extended Europe | `plink_1UaJ5pHv7Ryf9QPaMkYVLjtl` | 160 + 369 = 529 EUR | Deactivated; unapproved tariff |

The three deactivation API responses confirmed `active:false`. PL/DE links remain independent of the new order store; existing direct-link purchases require Dashboard fulfillment. No changes to their price/tax configuration were made.

## Implemented in code

- Existing design/media preserved. Multiple size/quantity cart, confirmed server quote, final total before Stripe, destination-controlled currency, no Payment Link fallback.
- Portable Node backend, server-only key, runtime price validation, allowed destinations and reviewed configurable zones, one shipping charge/order.
- Required Stripe address/phone collection, size summary/metadata, server-owned success/cancel URLs, no paid-by-query behavior.
- Signed raw-body webhook, canonical session retrieval, amount/country/mode validation, transactional event deduplication and persistent SQLite order/outbox records, retrying SMTP confirmation.
- Seller data supplied by user in policies; durable terms attachment. VAT is never added to the final price. Legal/accounting release review remains outstanding.
- Payments fail closed with missing credentials/release approvals. `checkoutApi` stays empty on the public storefront until actual Sandbox/Live end-to-end verification passes; the staging API is now available separately.

## Checks and actual limits

`npm run check`, `npm test` (26 local tests), dependency audit (0 vulnerabilities after upgrading Nodemailer), and `git diff --check` passed. Local tests use a Stripe API double and real Stripe SDK signature verification. They cover PL/DE/mixed sizes, one shipping fee, unconfirmed routes/packing, amount injection, idempotency, wrong mode/catalog, signature tampering/expiry, delayed success/failure, status authentication, database reopening, email retry, cart/country changes, cancel and forged success URLs.

**No real Sandbox payment, Live charge, live webhook delivery, actual email delivery or deployed browser E2E has passed.** The required browser skill path in the updated tool catalog is missing on disk, and the earlier GitHub browser session was unauthenticated. No visual screenshot verification is claimed.

Infrastructure discovery: no backend configuration/workflow in the existing branches; old removed Supabase function was explicitly a nondeployed draft. GitHub connector cannot read secrets APIs; local gh token invalid; browser GitHub settings requires sign-in. Therefore GitHub Secrets have NOT been verified absent. Vercel project lookup returned a team-access 403; it is not used as an assumed available backend. No API keys are present in this task environment. Connected Supabase lists two INACTIVE projects; the general personal project has no Edge Functions. The unrelated photo-sphere project was not modified. No active WU backend was identified at the initial audit; the general project has since been restored and the staging function deployed (see update below).

Release blockers:
1. Staging hosting access is now resolved through the deployed Supabase Free function. Configure its WU_STAGING_* Sandbox key/catalog IDs, webhook signing secret and TLS SMTP credentials directly in Supabase Secrets. Live will use a separate function/storage namespace after Sandbox verification. GitHub Secrets cannot be recovered into this chat.
2. Accountant confirmation of PL/DE VAT/OSS reporting and fiscal/invoice/KSeF flow, plus final seller policies review. No tax registration is inferred or created.
3. Real Sandbox end-to-end evidence followed by a controlled Live verification before merge/deploy.

International countries beyond PL/DE stay blocked until supported rates/customs are confirmed. Orders larger than the verified parcel capacity (default 1) stay blocked until packing capacity is approved. Configurable multi-item behavior is locally tested with capacity 4; this is not a claim that four garments fit.

See backend/README.md for exact environment names, endpoints and release procedure.

## Free backend deployment update

Existing general Supabase project restored on its Free plan, empty public schema confirmed, and WU staging API deployed:
https://fsosngspvclkgtbszwoc.supabase.co/functions/v1/wu-checkout-staging/health

Postgres orders/events/outbox are private with RLS and service-only RPC grants. 14 deployed HTTPS checks passed; transactional Postgres self-test passed and rolled back. Zero test records persist. No subscriptions were upgraded and no new storefront was created.

The infrastructure-access blocker is resolved for staging. Remaining configuration goes directly in Supabase Edge Functions Secrets with WU_STAGING_* names (backend/supabase/.env.example); no Render account or paid disk is needed. This staging function forces test mode and payments stay disabled pending keys/email/Sandbox E2E. A separate Live function/storage namespace is still required after tests.

Auto-review rejected a cron migration affecting shared extensions/net privileges. It was not applied; email retries use the persisted outbox plus Stripe webhook redelivery instead, as documented in backend/supabase/README.md. Supabase Free can pause after inactivity and has finite quotas.
