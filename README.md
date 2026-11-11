# rrose by wu?

Existing WU? storefront on GitHub Pages at https://wuisthequestion.com. Keep the existing camera interface, official logos, photos and domain.

Preview static files: `python3 -m http.server 3002`. Run checks: `npm ci`, `npm run check`, `npm test`.

Public display configuration is in product-config.js. `checkoutApi` must point to a separately deployed verified HTTPS backend; empty disables payment. No secrets belong in the storefront. The browser never determines payable prices or shipping charges. Currency follows delivery country (PLN for Poland, EUR for approved international routes).

Backend setup and operational details: backend/README.md. Current release evidence and blockers: STRIPE-LIVE-STAGING.md. Seller information, consumer terms and privacy: policies.html / policies.txt. Changes continue existing PR #6; do not merge before real Sandbox and Live verification.
