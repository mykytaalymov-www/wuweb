# WU? Stripe Live Checkout — staging checklist

This branch is **not deployed**. The production site keeps its existing Sandbox link.

## Approved business settings
- Product: `prod_VbTxAjvibHelD7` — RROSE skirt, clothing code `txcd_30011000`.
- PLN price: `price_1UaGzgHv7Ryf9QPajobbmb7t` — 699.00 PLN VAT-inclusive.
- EUR price: `price_1UaGziHv7Ryf9QPa2wcb62JL` — 160.00 EUR VAT-inclusive.
- PL courier: 29.00 PLN, one time per order.
- DE courier: 19.00 EUR, one time per order.
- Other countries: disabled. Packaging target 35 × 30 × 10 cm.
- Quantity: max 1 item, pending multi-item packaging approval.
- Stripe Tax: not enabled yet. No tax registrations exist in Stripe Tax. The VAT-inclusive price is a pricing choice, not a guarantee that the correct VAT is being calculated/accounted for on cross-border sales.

## Backend deployment
The backend draft is `backend/create-checkout-session.ts`, intended for a dedicated secure Edge Function in a project owned by WU?. Do not deploy into unrelated Supabase projects.

Set secrets (server-side ONLY):
- `STRIPE_SECRET_KEY` (for test use `sk_test_...`; for production `sk_live_...`)
- `WU_PRICE_PLN` (test ID for sandbox tests, Live ID above in production)
- `WU_PRICE_EUR` (ditto)

The function accepts only PL/DE, S-M/M-L, and exactly one item. It fixes price and shipping on the server and restricts the Stripe address country. No prices or secrets are accepted from the browser.

## Before live rollout
1. Host the function in a dedicated backend with throttling/bot protection; configure proper OPTIONS/CORS and set `verify_jwt=false` only for this public endpoint.
2. Attach `checkout-live-config.js` to the storefront and build frontend integration (country switch, one-item maximum, spinner, errors). Never trust browser totals.
3. Verify success server-side by retrieving the Checkout Session and confirming `payment_status=paid`. Do NOT mark orders paid based on URL query parameters.
4. Implement a verified `checkout.session.completed` webhook for order fulfillment. Verify the Stripe signature and ensure idempotent processing. Confirm asynchronous payment methods if enabled.
5. Check email receipts, order size metadata, delivery address and all legal policies (VAT/OSS, returns, privacy, shipping).
6. Test in Stripe Sandbox using test product/price IDs and test payment methods. Check PL/DE restrictions, cancellation, quantity, multi-item, attempted price tampering, and duplicate webhook deliveries.
7. Only after staging tests pass, configure production secret and live prices, deploy backend, switch frontend feature flag to true and deploy main.

Stripe fixed shipping data can be passed inline to Checkout Session; creating a separate Shipping Rate object is optional. The connector did not expose a Shipping Rate create operation, so none was created at this step.
