# WU checkout service

A free Supabase staging variant is now deployed; see backend/supabase/README.md for its URL and WU_STAGING_* secrets. The instructions below describe the original standalone Docker alternative.

Existing storefront stays on GitHub Pages. This backend is a standalone Node 24 service with SQLite on a **persistent local volume**, not an ephemeral serverless filesystem. Run one instance and one mail worker. TLS, ingress rate limiting, encrypted disk/backups, restricted operator access and a tested restore are deployment requirements. The Docker alternative has not been provisioned; no Live production endpoint is claimed.

## Run

`npm ci`, supply environment variables from `.env.example` using the host secret store, then `npm start`. For local use only, Node supports `node --env-file=.env backend/server.mjs`. Docker: build this directory, mount a persistent volume at `/data`, expose port 8787 behind HTTPS. Do not mount the repository as a public static directory. Store keys only in the backend environment. Prefer restricted Stripe keys with Prices/Products read and Checkout Sessions write/read permissions. Use separate test and live credentials and separate databases. The webhook signing secret is not an API key.

Public routes: POST `/quote`, POST `/checkout`, GET `/countries`, GET `/orders/:id`, GET `/health`. Browser routes require the exact `STOREFRONT_ORIGIN`; CORS does not replace authentication. `/checkout` requires random UUID `Idempotency-Key` plus a 256-bit bearer token; `/orders` requires the same token. Only its hash is stored. Tokens never appear in URLs or logs. Backend returns no customer PII from the status route. The browser keeps the token in sessionStorage; other browsers cannot retrieve the order without it.

POST body: `{"country":"PL","items":[{"size":"S-M","quantity":1}]}`. Amounts, currencies, URLs, price IDs and shipping from the client are rejected. `/quote` works while payments are disabled. Live uses only the existing product and immutable price IDs. Test mode requires existing equivalent Sandbox IDs; do not pass Live IDs to Sandbox. Checkout re-reads the price/product and fails closed on any mismatch. Sizes are stored in order data, Checkout metadata, PaymentIntent metadata and visible Checkout summary. The price line quantity equals the sum across sizes. Shipping is a **single shipping option**, never a product line item.

Set Stripe public business terms/privacy URLs to `https://wuisthequestion.com/policies.html` before using required Checkout terms consent. Update `product-config.js` `checkoutApi` only with the verified backend HTTPS origin. An empty value disables checkout; there is no Payment Link fallback.

## Webhook and email

POST `/webhook`, raw body and Stripe signature required. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Unknown unrelated Payment Link sessions are ignored. Sessions with unknown WU order IDs retry instead of being lost. Retrieve the current session and validate order reference, session identity, mode, country, currency, subtotal, total, shipping and contact details. A query string never marks an order paid. Delayed payments remain pending. Payment status is monotonic for Checkout events. Refunds/disputes are managed in Stripe Dashboard: this service does not automate returns/refund fulfillment.

Order transition, event deduplication and mail outbox insertion are one SQLite transaction. Duplicate event deliveries and different paid events enqueue one confirmation. Mail retries with backoff; no paid order is rolled back on email failure. Configure SMTP credentials with TLS and a verified sender, then verify actual customer and merchant delivery. Stable Message-ID mitigates duplicates, but SMTP cannot promise exactly-once delivery across a crash after SMTP acceptance. Monitor pending/failed mail jobs and webhook delivery failures. Email is a payment confirmation, not a Polish fiscal receipt/invoice. The attached terms are a durable text copy.

## Shipping

PL 2900 PLN minor units and DE 1900 EUR minor units are merchant-approved **per order** rates. No carrier booking/label integration or unverified international tariff is represented as connected. Base parcel 35×30×10 cm, about 1 kg per garment. DHL divisor 5000 gives dimensional weight 2.1 kg; actual chargeable weight/rounding depends on carrier contract. `PACKAGE_MAX_ITEMS=1` fails closed until the merchant checks how many items fit this parcel. Increase only for a physically verified capacity covered by the fixed rate. Larger quantities require a new confirmed packing/rate arrangement, not multiplying shipping silently.

Optional `SHIPPING_ZONES_JSON` extends countries with reviewed fixed order tariffs. Each entry needs `id`, unique `countries` (ISO alpha-2), `currency:"eur"`, integer `amount` (minor units), `source` (official carrier quote/API reference), `approvedAt`, future `validUntil`, `customsReviewed:true`, `maxItems` (1–20). Expired/ambiguous entries fail closed. Add enabled destinations to the existing country selector as needed. Unlisted countries return `shipping_unavailable`; there is no WORLD fallback price. Review remote-area/postcode exclusions before enabling countrywide rates. A quote with such exclusions cannot be used as a countrywide fixed tariff.

Non-EU release requires carrier serviceability/sanctions and goods restrictions, actual garment origin/composition, validated customs classification, commercial invoice, EORI/export declarations where applicable, and explicit DAP/DDP/import-charge terms. None is inferred from the seller's Polish address. No HS code or customs value is fabricated.

## Tax and legal release

Both existing Live prices are inclusive. `automatic_tax` remains false and no manual tax rate is added, preserving the declared final total. This does **not** create a VAT calculation or satisfy reporting obligations. Stripe Live Tax Settings are active but registrations are empty (audit 2026-11-11). Product clothing tax code differs from account's general preset; existing product code is preserved.

A Polish VAT-registered spółka must settle Polish and cross-border VAT correctly. The EU-wide EUR 10,000 threshold and conditions, elective destination taxation and Union OSS/local registration need assessment against actual turnover and registrations; do not infer OSS merely from Germany shipping. Confirm PLN conversion, VAT on delivery, fiscal receipt/cash-register rules, invoicing/KSeF applicability and required documents with the accountant. Stripe payment receipts and our emails are not substitutes. No tax registrations are created automatically.

Seller particulars supplied in chat are in policies.txt/html. Review delivery promises, physical return address, consumer withdrawal/complaints information, privacy processors/international transfer safeguards, retention and applicable mandatory consumer rules before enabling checkout. Set `LEGAL_REVIEW_APPROVED` and `TAX_REVIEW_APPROVED` only after that review, not merely because pages exist.

Primary references checked:
- https://podatki.gov.pl/pozostale/tax-free-vat-refund-vap-oss-i-ioss/punkt-kompleksowej-obslugi-oss-i-ioss
- https://biznes.gov.pl/pl/portal/00270
- https://prawakonsumenta.uokik.gov.pl/prawo-odstapienia-od-umowy/terminy-odstapienie/
- https://www.dhl.com/discover/en-gb/ship-with-dhl/products-and-services/weight-and-dimensions
- https://docs.stripe.com/checkout/fulfillment
- https://docs.stripe.com/webhooks/signature

## Release evidence required

1. `npm run check && npm test` locally and in CI. These tests use a Stripe double plus real SDK webhook signatures and are **not Sandbox payments**.
2. Deploy isolated test backend + persistent DB; configure Sandbox prices, key, signature secret, SMTP and terms URLs. Create/reuse a Sandbox, not Live products. Exercise real hosted Checkout with successful card, declined card, authentication, abandoned/cancelled session, asynchronous success/failure; verify signed webhook, order rows, email and restart persistence. Test each supported country/currency and multi-size packing capacity. Record evidence before setting `SANDBOX_VERIFIED_AT`.
3. Deploy isolated Live backend with restricted key and existing Live product/prices; create endpoint only after HTTPS works. Complete controlled Live payment with user authorization and inspect Stripe, order, delivery details, notifications and refund as appropriate. Do not claim Live based on session creation or redirects.
4. Set release approvals and verified backend URL, run CI, then merge existing PR #6 and verify GitHub Pages at wuisthequestion.com, full payable totals (PL 728 PLN / DE 179 EUR for one item), media/design, policies and payment flow. No merge or production activation until required evidence exists.
