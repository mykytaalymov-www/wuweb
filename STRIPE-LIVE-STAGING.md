# WU? RROSE — Stripe Live Checkout release review

**Status: STAGED ONLY. Not merged to main, not published.**

## Verified in Stripe Live

| Shipping destination | RROSE (VAT-inclusive) | Fixed courier fee (VAT-inclusive) | Total |
| --- | ---: | ---: | ---: |
| Poland only | 699 PLN | 29 PLN | **728 PLN** |
| Germany only | 160 EUR | 19 EUR | **179 EUR** |

- RROSE product `prod_VbTxAjvibHelD7`, clothing tax category `txcd_30011000`.
- Polish live payment link: `plink_1UaHLiHv7Ryf9QPa8nqUnJBx`
  `https://buy.stripe.com/dRm6oHfN5bXi1pXeJp67S00`
- German live payment link: `plink_1UaHLlHv7Ryf9QPaTXFLiPFs`
  `https://buy.stripe.com/6oU4gz6cvf9u8Sp9p567S01`
- Both links have 2 line items (product and fixed delivery), precisely 1 of each.
- Both force the correct shipping country in Stripe.
- Both collect shipping address, phone, and require size dropdown (S-M / M-L).
- Both use Stripe-hosted confirmation; storefront never assumes a return URL proves payment.
- Stripe Tax is disabled for now; price and shipping fee tax behavior are inclusive. VAT remains an accounting obligation outside Stripe Tax.
- All prices are fixed by Stripe, not supplied from client JS.
- The staged website removes the test Payment Link and restricts cart quantity to one skirt.

## IMPORTANT: limitations before launch

- RROSE size must be selected again on the Stripe checkout page (required field). The Stripe choice controls fulfillment. The browser's bag selection is informational only.
- Delivery packaging assumed 35 × 30 × 10 cm, 1 kg. Confirm one item really fits in this package.
- Stripe Tax has NO registrations even though merchant is VAT-registered. Ensure accountant confirms Polish and cross-border VAT reporting/OSS and receipt/invoice obligations.
- Stripe does not generate a post-purchase invoice for these links. Confirm Polish fiscal/documentation rules with accountant. Merchant can see orders in Stripe Dashboard.
- Seller identity, privacy policy, terms, distance-sale withdrawal information, shipping and return policies have NOT been validated. Verify them before putting live payment links on the production website.
- Payment confirmation, receipt, payout, and operational fulfillment have NOT been end-to-end tested with a real card. Complete manual smoke tests and inspect the resulting payment in Stripe before launch.
- For fulfillment, use Stripe Dashboard payment status (paid/succeeded); do not trust just a redirected URL or email alone.

## Release

1. Review the draft branch code and the Stripe-hosted checkout pages without paying.
2. Confirm the seller/legal/consumer details and accounting approach.
3. Complete a controlled end-to-end live charge (and refund if appropriate), confirming the customer address, requested size, amount, receipt, and order record.
4. Only when all checks pass, merge this PR to main. GitHub Pages serves main directly.
5. Confirm the live site routes Polish orders to 728 PLN and German orders to 179 EUR.

No Vercel, backend secrets, or Supabase is required for this deliberately limited one-item launch.
