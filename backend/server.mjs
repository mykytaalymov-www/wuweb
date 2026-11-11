import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { Store } from './store.mjs';
import { Checkout, readiness } from './checkout.mjs';
import { Problem, quote, shippingZones } from './catalog.mjs';
import { drainMail } from './mail.mjs';

async function body(req, limit) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Problem(413, 'body_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function makeServer({ env, checkout }) {
  const attempts = new Map();
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Vary', 'Origin');
    const send = (status, data) => { res.writeHead(status); res.end(JSON.stringify(data)); };
    try {
      const url = new URL(req.url, 'http://backend');
      if (req.method === 'POST' && url.pathname === '/webhook') {
        await checkout.event(await body(req, 262144), req.headers['stripe-signature']);
        return send(200, { received: true });
      }
      if (req.headers.origin !== env.STOREFRONT_ORIGIN) throw new Problem(403, 'invalid_origin');
      res.setHeader('Access-Control-Allow-Origin', env.STOREFRONT_ORIGIN);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Idempotency-Key');
      if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      // Socket address only: never trust client-supplied X-Forwarded-For.
      // Configure the ingress rate limiter as well (all proxied callers may share this bucket).
      const now = Date.now(), ip = req.socket.remoteAddress;
      for (const [key, entry] of attempts) if (entry.until < now) attempts.delete(key);
      const bucket = attempts.get(ip) || { count: 0, until: now + 60000 };
      bucket.count++; attempts.set(ip, bucket);
      if (bucket.count > 120) throw new Problem(429, 'rate_limited');
      if (url.pathname === '/health' && req.method === 'GET')
        return send(200, { ready: readiness(env), mode: env.STRIPE_MODE });
      if (url.pathname === '/countries' && req.method === 'GET')
        return send(200, { countries: shippingZones(env).flatMap(z => z.countries), maxItems: Number(env.PACKAGE_MAX_ITEMS || 1) });
      if (req.method === 'GET' && /^\/orders\/[0-9a-f-]{36}$/.test(url.pathname))
        return send(200, await checkout.status(url.pathname.split('/')[2], req.headers.authorization?.replace(/^Bearer /, '')));
      if (req.method === 'POST' && ['/quote','/checkout'].includes(url.pathname)) {
        if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new Problem(415, 'json_required');
        let input;
        try { input = JSON.parse((await body(req, 4096)).toString()); }
        catch (e) { if (e instanceof Problem) throw e; throw new Problem(400, 'invalid_json'); }
        if (url.pathname === '/quote') return send(200, quote(input, env));
        return send(200, await checkout.create(input, req.headers['idempotency-key'], req.headers.authorization?.replace(/^Bearer /, '')));
      }
      throw new Problem(404, 'not_found');
    } catch (e) {
      if (!(e instanceof Problem)) console.error('Checkout operation failed', { type: e.type || e.name });
      send(e instanceof Problem ? e.status : 503, { error: e instanceof Problem ? e.message : 'service_unavailable' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const env = { ...process.env };
  const origin = new URL(env.STOREFRONT_ORIGIN || 'https://wuisthequestion.com');
  if (origin.origin !== (env.STOREFRONT_ORIGIN || origin.origin) ||
      (origin.protocol !== 'https:' && origin.hostname !== 'localhost')) throw new Error('Invalid storefront origin');
  env.STOREFRONT_ORIGIN = origin.origin;
  env.POLICY_TEXT = readFileSync(new URL('../policies.txt', import.meta.url), 'utf8');
  const path = env.DATABASE_PATH || './data/orders.sqlite'; mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const store = new Store(path);
  const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'rk_test_disabled', { apiVersion: '2026-09-30.endive', maxNetworkRetries: 2, timeout: 10000 });
  const checkout = new Checkout({ stripe, store, env });
  const transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 465),
    secure: env.SMTP_PORT !== '587', requireTLS: true, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    connectionTimeout: 10000, socketTimeout: 15000, disableFileAccess: true, disableUrlAccess: true });
  let draining = false;
  const timer = setInterval(async () => {
    if (draining || !env.SMTP_HOST) return;
    draining = true;
    try { await drainMail(store, transport, env); } catch { console.error('Mail worker failed; will retry'); } finally { draining = false; }
  }, 15000);
  const server = makeServer({ env, checkout });
  server.listen(Number(env.PORT || 8787), '0.0.0.0', () => console.log('WU backend listening; checkout ready:', readiness(env)));
  const stop = () => { clearInterval(timer); server.close(() => { store.close(); transport.close(); }); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
