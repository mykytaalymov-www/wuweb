# rrose by wu?

Existing WU? storefront on GitHub Pages: https://wuisthequestion.com. The camera interface, official logos, photos, CSS and domain are retained.

## Current checkout: Stripe-hosted, no backend required

One or two RROSE per order, size S-M or M-L. Pairs can contain either size or one of each. Choose the destination in the bag before payment:

- Poland: 699 PLN + one courier delivery 29 PLN = 728 PLN, VAT included.
- Germany: 160 EUR + one courier delivery 19 EUR = 179 EUR, VAT included.
- Other supported EU countries: 160 + 49 = 209 EUR.
- UK, Norway, Switzerland: 160 + 99 = 259 EUR.
- Extended Europe (19 countries/territories listed in product-config.js): 160 + 369 = 529 EUR.
- Worldwide: 160 + 60 = 220 EUR for one skirt; 320 + 60 = 380 EUR for two.
- Delivery covers up to two skirts once per order, as confirmed by the owner. 215 destinations are enabled across the six zones; restricted/unsupported routes stay blocked.

The existing Live Payment Links enforce the actual prices, quantities and delivery countries inside Stripe. Frontend totals are only a display; the browser never supplies a payable amount. A required size dropdown, shipping address and phone are collected by Stripe. For single-item links the size chosen in Stripe controls fulfillment. For pairs, the exact size combination is enforced by a single allowed dropdown option and Stripe metadata. Saved bags larger than two must be reduced to two before checkout; their contents are not silently discarded.

After payment Stripe hosts confirmation. The seller checks paid/succeeded in Stripe Dashboard and manually prepares dispatch, tracking and customer support. The owner confirmed enabling Stripe Successful payments emails. Actual inbox delivery has not been verified; fiscal/invoice handling remains a seller process. Stripe invoices are currently disabled. A query string on this site never proves payment and never empties a paid cart.

A controlled Live 2 PLN payment through a separate, structurally equivalent hosted link succeeded on 2026-11-11. Stripe confirmed paid/complete and succeeded, with size/contact/address captured. That verification link is now disabled. It did not use or verify the optional custom backend.

## Development

Preview: python3 -m http.server 3002. Checks: npm ci, npm run check, npm test (34 tests). Public display configuration is in product-config.js. No Stripe secret belongs in frontend code.

Optional server-side implementations remain in backend/ for a future automated flow; they are not used by the current hosted checkout. The Supabase Free staging API stays test-only and disabled for payments. See backend/supabase/README.md only when working on that optional path. GitHub Pages excludes backend sources and Supabase migrations.

Seller information and customer policies: policies.html / policies.txt. Release evidence: STRIPE-LIVE-STAGING.md.
