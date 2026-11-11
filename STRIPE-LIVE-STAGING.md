# WU? hosted Live checkout release evidence — 2026-11-11

## Final launch scope

The existing GitHub Pages site uses the existing country-locked Stripe Live Payment Links. One RROSE per checkout; size confirmed on Stripe. No backend key, SMTP setup or paid hosting is needed for this launch. Design, CSS/media and domain are preserved. The separate Supabase staging backend is not part of the purchase path.

| Destination | Product | One delivery | Total |
| --- | ---: | ---: | ---: |
| PL | 699 PLN | 29 PLN | 728 PLN |
| DE | 160 EUR | 19 EUR | 179 EUR |

VAT is included. No VAT or second shipping fee is added by the browser. Other countries cannot proceed to payment.

Existing product: prod_VbTxAjvibHelD7. Existing regular prices: price_1UaGzgHv7Ryf9QPajobbmb7t and price_1UaGziHv7Ryf9QPa2wcb62JL.

PL link: https://buy.stripe.com/dRm6oHfN5bXi1pXeJp67S00
DE link: https://buy.stripe.com/6oU4gz6cvf9u8Sp9p567S01

Both links were read from Stripe Live: active, fixed product and delivery quantities 1 each, correct currency, required size S-M/M-L, address/phone collection and country restriction. All line-item totals were rechecked immediately before release. Shipping is already a line item in Stripe; the frontend does not add another payment line.

## Actual Live payment verified

The user explicitly authorized a controlled small Live purchase. A separate verification price/link was created on the existing RROSE product. The initial 1 EUR link was disabled when the user requested PLN. Stripe rejected 1 PLN as below its minimum; after explicit user approval, a 2 PLN link was used.

The user completed the 2 PLN payment. Direct Stripe retrieval verified:
- livemode true, Checkout complete and payment_status paid;
- PaymentIntent succeeded and amount_received 200 PLN minor units;
- size S-M and shipping address/phone/email collected;
- the verification link was disabled after success, with a one-completed-session limit.

The regular 699 PLN / 160 EUR prices were unchanged. Verification prices are not exposed by the storefront. No refund or additional charge was initiated. No personal customer data or card details are stored in this repository.

This verifies Stripe-hosted payment, not the optional backend webhook/email flow. No 728 PLN or 179 EUR test charge was made.

## Checks

29 automated tests cover dynamic backend regressions and the active hosted route: country/total/link mapping, one-item capacity, disabled unconfirmed routes, old saved multi-item bags, cancel/forged-paid URLs and no dependency on backend availability for hosted checkout. npm run check and git diff --check also pass. CI must pass on the final commit before merging this existing PR.

After merging, verify the actual Pages build and fetch the published product-config.js/script.js to confirm hosted Live mode and the correct links. Do not claim a visual browser check when only source/DOM tests were performed.

## Operating limits

The seller fulfills orders manually from Stripe Dashboard, using paid/succeeded status and the required size field. Stripe hosts the buyer's payment confirmation. Customer receipt emails can be enabled in Stripe, but their automatic delivery has not been checked. Automatic Stripe invoices are disabled; the seller's VAT/fiscal/invoice/OSS obligations still need the appropriate accounting process. These are not solved by a payment receipt.

International tariffs beyond PL/DE and multiple-item parcel capacity are unconfirmed and remain blocked. Three existing links with unapproved 49/99/369 EUR shipping were disabled during the audit. No carrier API or label booking is claimed.

## Optional backend retained separately

Supabase Free staging API exists at https://fsosngspvclkgtbszwoc.supabase.co/functions/v1/wu-checkout-staging/health. It is test-only, payment-disabled and excluded from the hosted flow. Its earlier 14 HTTPS checks and transactional Postgres self-test passed, but no actual Sandbox payment or SMTP delivery passed there. No paid subscription was added. See backend/supabase/README.md for that optional implementation.
