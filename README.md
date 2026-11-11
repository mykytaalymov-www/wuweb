# rrose by wu?

Existing WU? storefront on GitHub Pages: https://wuisthequestion.com. The camera interface, official logos, photos, CSS and domain are retained.

## Current checkout: Stripe-hosted, no backend required

One RROSE per order, size S-M or M-L confirmed on Stripe. Choose the destination in the bag before payment:

- Poland: 699 PLN + one courier delivery 29 PLN = 728 PLN, VAT included.
- Germany: 160 EUR + one courier delivery 19 EUR = 179 EUR, VAT included.
- Other supported EU countries: 160 + 49 = 209 EUR.
- UK, Norway, Switzerland: 160 + 99 = 259 EUR.
- Extended Europe (19 countries/territories listed in product-config.js): 160 + 369 = 529 EUR.
- Remaining worldwide destinations stay unavailable: the old 75 EUR value is marked demo, and no matching Live tariff was found.

The existing Live Payment Links enforce the actual prices, quantities and delivery countries inside Stripe. Frontend totals are only a display; the browser never supplies a payable amount. A required size dropdown, shipping address and phone are collected by Stripe. The size chosen in Stripe controls fulfillment; the bag size is a reconciliation hint. Saved multi-item bags must be reduced to one item before checkout; their contents are not silently discarded.

After payment Stripe hosts confirmation. The seller checks paid/succeeded in Stripe Dashboard and manually prepares dispatch, tracking and customer support. Automatic customer receipt delivery and fiscal/invoice handling are not claimed verified. Stripe invoices are currently disabled. A query string on this site never proves payment and never empties a paid cart.

A controlled Live 2 PLN payment through a separate, structurally equivalent hosted link succeeded on 2026-11-11. Stripe confirmed paid/complete and succeeded, with size/contact/address captured. That verification link is now disabled. It did not use or verify the optional custom backend.

## Development

Preview: python3 -m http.server 3002. Checks: npm ci, npm run check, npm test (31 tests). Public display configuration is in product-config.js. No Stripe secret belongs in frontend code.

Optional server-side implementations remain in backend/ for a future multi-item/automated flow; they are not used by the current hosted checkout. The Supabase Free staging API stays test-only and disabled for payments. See backend/supabase/README.md only when working on that optional path. GitHub Pages excludes backend sources and Supabase migrations.

Seller information and customer policies: policies.html / policies.txt. Release evidence: STRIPE-LIVE-STAGING.md.
