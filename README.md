# rrose by wu?

Single-product static storefront using supplied official SVG logos and authorized photos.

Run `python3 -m http.server 3002` in this directory.

Public editable commercial data is in product-config.js: sizes, explicit EUR/PLN prices, Instagram, and per-length/currency/size hosted checkout URLs. No secrets belong in this file. Purchases remain disabled until a payment service is configured. GitHub Pages cannot run a payment backend; hosted checkout or an external backend is required.

Currency suggestion uses browser timezone, not IP geolocation, with manual selection and persisted preference. No exchange rates are invented. Both lengths currently use the supplied EUR 160 / PLN 699 pricing pending confirmation. Long-length sizing: hips SM 94–97 cm / ML 100–103 cm, length 89 cm, 100% cotton twill, below-waist fit. Short-length measurements and inventory/lead times remain unconfirmed. Shipping rates, returns, seller/legal terms and payment setup must be confirmed before launch for purchases.

Intro uses the original question-mark SVG with outline drawing, reflected copy and fill reveal; skip control, reduced-motion handling and session-only display.
