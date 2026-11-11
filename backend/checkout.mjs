import { createHash, timingSafeEqual } from 'node:crypto';
import { quote, PRODUCT, PRICES, Problem } from './catalog.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
export function authenticate(order, token) {
  if (!order || typeof token !== 'string' || token.length < 32 || token.length > 128 ||
      !timingSafeEqual(Buffer.from(order.token_hash), Buffer.from(hash(token)))) throw new Problem(404, 'order_not_found');
}

export function readiness(env) {
  const live = env.STRIPE_MODE === 'live';
  return env.CHECKOUT_ENABLED === 'true' && ['test','live'].includes(env.STRIPE_MODE) &&
    new RegExp(`^(rk|sk)_${live ? 'live' : 'test'}_`).test(env.STRIPE_SECRET_KEY || '') &&
    !!env.STRIPE_WEBHOOK_SECRET && !!env.SMTP_HOST && !!env.MAIL_FROM &&
    !!env.SMTP_USER && !!env.SMTP_PASSWORD && !!env.MERCHANT_EMAIL &&
    (live ? env.LIVE_RELEASE_APPROVED === 'true' && env.TAX_REVIEW_APPROVED === 'true' &&
      env.LEGAL_REVIEW_APPROVED === 'true' && !!env.SANDBOX_VERIFIED_AT :
      !!env.STRIPE_TEST_PRICE_PLN && !!env.STRIPE_TEST_PRICE_EUR && !!env.STRIPE_TEST_PRODUCT);
}

export class Checkout {
  constructor({ stripe, store, env }) { Object.assign(this, { stripe, store, env }); }
  async create(input, id, token) {
    if (!readiness(this.env)) throw new Problem(503, 'checkout_unavailable');
    if (!/^[0-9a-f-]{36}$/.test(id || '') || !/^[a-zA-Z0-9_-]{43,128}$/.test(token || '')) throw new Problem(400, 'invalid_request_key');
    const q = quote(input, this.env);
    const fingerprint = hash(JSON.stringify(q));
    const old = await this.store.get(id);
    if (old) {
      authenticate(old, token);
      if (old.fingerprint !== fingerprint) throw new Problem(409, 'request_key_reused');
      // Never reuse a Stripe idempotency key after its retention window.
      if (Date.now() - old.created > 23 * 3600_000) throw new Problem(409, 'checkout_expired');
      if (old.status !== 'pending') throw new Problem(409, 'order_already_processed');
      if (old.checkout_url) return { id, url: old.checkout_url, quote: q };
    }
    const order = await this.store.create({ id, tokenHash: hash(token), fingerprint, quote: q, created: Date.now() });
    authenticate(order, token);
    if (order.fingerprint !== fingerprint) throw new Problem(409, 'request_key_reused');
    const live = this.env.STRIPE_MODE === 'live';
    const priceId = live ? PRICES[q.currency].id : this.env[`STRIPE_TEST_PRICE_${q.currency.toUpperCase()}`];
    const price = await this.stripe.prices.retrieve(priceId, { expand: ['product'] });
    const product = price.product;
    if (!price.active || price.livemode !== live || price.currency !== q.currency || price.unit_amount !== q.unitAmount ||
        price.tax_behavior !== 'inclusive' || price.type !== 'one_time' || price.transform_quantity ||
        typeof product !== 'object' || !product.active || product.id !== (live ? PRODUCT : this.env.STRIPE_TEST_PRODUCT))
      throw new Problem(503, 'catalog_mismatch');
    const summary = q.items.map(i => `${i.size} × ${i.quantity}`).join(', ');
    const metadata = { order_id: id, items: JSON.stringify(q.items), country: q.country };
    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment', client_reference_id: id, metadata,
      integration_identifier: 'wu_checkout_rrxqzpma',
      line_items: [{ price: priceId, quantity: q.quantity }],
      shipping_address_collection: { allowed_countries: [q.country] },
      phone_number_collection: { enabled: true }, customer_creation: 'always',
      shipping_options: [{ shipping_rate_data: { type: 'fixed_amount', display_name: 'Courier delivery',
        fixed_amount: { amount: q.shipping, currency: q.currency }, tax_behavior: 'inclusive' } }],
      automatic_tax: { enabled: false }, adaptive_pricing: { enabled: false },
      allow_promotion_codes: false,
      custom_text: { submit: { message: `RROSE: ${summary}. VAT included. Delivery charged once per order.` } },
      payment_intent_data: { metadata },
      consent_collection: { terms_of_service: 'required' },
      success_url: `${this.env.STOREFRONT_ORIGIN}/?checkout=returned`,
      cancel_url: `${this.env.STOREFRONT_ORIGIN}/?checkout=cancelled`,
      expires_at: Math.floor(order.created / 1000) + 3600
    }, { idempotencyKey: `wu:${id}` });
    if (session.livemode !== live || !session.url || new URL(session.url).origin !== 'https://checkout.stripe.com')
      throw new Problem(502, 'invalid_checkout_response');
    await this.store.attach(id, session);
    return { id, url: session.url, quote: q };
  }

  async event(raw, signature) {
    let event;
    try { event = await this.stripe.webhooks.constructEvent(raw, signature, this.env.STRIPE_WEBHOOK_SECRET); }
    catch { throw new Problem(400, 'invalid_signature'); }
    const supported = ['checkout.session.completed','checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed','checkout.session.expired'];
    if (!supported.includes(event.type)) return;
    if (event.livemode !== (this.env.STRIPE_MODE === 'live')) throw new Problem(400, 'wrong_mode');
    const incoming = event.data.object;
    const order = await this.store.get(incoming.metadata?.order_id);
    // Ignore unrelated Payment Link sessions on the same account.
    if (!order) {
      if (incoming.metadata?.order_id) throw new Problem(409, 'order_missing');
      return;
    }
    // Retrieve current Stripe state so out-of-order failure/expiry events cannot undo payment.
    const session = await this.stripe.checkout.sessions.retrieve(incoming.id);
    const q = JSON.parse(order.quote);
    const shipping = session.collected_information?.shipping_details || session.shipping_details;
    if (session.livemode !== event.livemode || session.metadata?.order_id !== order.id ||
        session.client_reference_id !== order.id || (order.session_id && order.session_id !== session.id) ||
        session.currency !== q.currency || session.amount_total !== q.total ||
        session.amount_subtotal !== q.subtotal || session.total_details?.amount_shipping !== q.shipping ||
        session.total_details?.amount_discount !== 0 || session.total_details?.amount_tax !== 0)
      throw new Problem(409, 'payment_mismatch');
    let status = session.status === 'expired' ? 'expired' : 'pending';
    if (session.payment_status === 'paid') {
      if (shipping?.address?.country !== q.country || !session.customer_details?.email || !session.customer_details?.phone)
        throw new Problem(409, 'customer_details_mismatch');
      status = 'paid';
    } else if (event.type === 'checkout.session.async_payment_failed') status = 'failed';
    await this.store.apply(event, order, session, status);
    return { orderId: order.id, status };
  }

  async status(id, token) {
    const order = await this.store.get(id); authenticate(order, token);
    return { id, status: order.status, quote: JSON.parse(order.quote) };
  }
}
