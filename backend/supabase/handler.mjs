import { quote, Problem, shippingZones } from '../catalog.mjs';
import { Checkout, readiness } from '../checkout.mjs';
import { drainMail } from '../mail.mjs';

async function readBody(request, limit) {
  if (Number(request.headers.get('content-length')) > limit) throw new Problem(413, 'body_too_large');
  const reader = request.body?.getReader(); if (!reader) return new Uint8Array();
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new Problem(413, 'body_too_large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export function createEdgeHandler({ env, stripe, store, transport }) {
  // Staging has independent WU_STAGING_* secrets and can never select live mode.
  const origins = new Set(['https://wuisthequestion.com', 'http://localhost:3002']);
  return async request => {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/(?:functions\/v1\/)?wu-checkout-staging(?=\/|$)/, '') || '/';
    const origin = request.headers.get('origin');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin', 'Referrer-Policy': 'no-referrer' };
    if (origins.has(origin)) Object.assign(headers, {
      'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,Idempotency-Key'
    });
    const json = (status, data) => new Response(JSON.stringify(data), { status, headers });
    const activeEnv = { ...env, STRIPE_MODE: 'test', STOREFRONT_ORIGIN: origins.has(origin) ? origin : 'https://wuisthequestion.com' };
    const checkout = new Checkout({ env: activeEnv, stripe, store });
    try {
      if (path === '/health' && request.method === 'GET') {
        const healthy = await store.health();
        return json(healthy ? 200 : 503, { service: 'wu-checkout-staging', database: !!healthy,
          mode: 'test', ready: readiness(activeEnv), hosting: 'Supabase Free', version: 'edge-1' });
      }
      if (path === '/webhook' && request.method === 'POST') {
        const result = await checkout.event(await readBody(request, 262144), request.headers.get('stripe-signature'));
        if (result?.status === 'paid') {
          await drainMail(store, transport, activeEnv);
          // Leave Stripe delivery unacknowledged until this confirmation is sent.
          // A later retry reuses the paid order and persistent outbox, never charging again.
          if (await store.mailPending(result.orderId)) throw new Problem(503, 'email_retry_pending');
        }
        return json(200, { received: true });
      }
      if (!origins.has(origin)) throw new Problem(403, 'invalid_origin');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      // DB-backed, global per-route budget. No reliance on caller-controlled IP headers.
      if (!await store.rateLimit(path.startsWith('/orders/') ? 'orders' : path)) throw new Problem(429, 'rate_limited');
      if (request.method === 'GET' && path === '/countries') return json(200, {
        countries: shippingZones(activeEnv).flatMap(z => z.countries), maxItems: Number(activeEnv.PACKAGE_MAX_ITEMS || 1)
      });
      const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
      if (request.method === 'GET' && /^\/orders\/[0-9a-f-]{36}$/.test(path))
        return json(200, await checkout.status(path.split('/')[2], token));
      if (request.method === 'POST' && ['/quote', '/checkout'].includes(path)) {
        if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new Problem(415, 'json_required');
        let input;
        try { input = JSON.parse(new TextDecoder().decode(await readBody(request, 4096))); }
        catch (e) { if (e instanceof Problem) throw e; throw new Problem(400, 'invalid_json'); }
        if (path === '/quote') return json(200, quote(input, activeEnv));
        return json(200, await checkout.create(input, request.headers.get('idempotency-key'), token));
      }
      throw new Problem(404, 'not_found');
    } catch (e) {
      if (!(e instanceof Problem)) console.error('WU edge operation failed', { type: e.name });
      return json(e instanceof Problem ? e.status : 503, { error: e instanceof Problem ? e.message : 'service_unavailable' });
    }
  };
}
