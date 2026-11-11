import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { SupabaseStore } from './store.mjs';
import { createEdgeHandler } from './handler.mjs';
import { POLICY_TEXT } from './policy.mjs';

const get = (name: string) => Deno.env.get(`WU_STAGING_${name}`) || '';
const env = {
  STRIPE_MODE: 'test', STRIPE_SECRET_KEY: get('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: get('STRIPE_WEBHOOK_SECRET'),
  STRIPE_TEST_PRODUCT: get('STRIPE_TEST_PRODUCT'),
  STRIPE_TEST_PRICE_PLN: get('STRIPE_TEST_PRICE_PLN'), STRIPE_TEST_PRICE_EUR: get('STRIPE_TEST_PRICE_EUR'),
  CHECKOUT_ENABLED: get('CHECKOUT_ENABLED') || 'false', PACKAGE_MAX_ITEMS: get('PACKAGE_MAX_ITEMS') || '1',
  SMTP_HOST: get('SMTP_HOST'), SMTP_PORT: get('SMTP_PORT') || '465', SMTP_USER: get('SMTP_USER'),
  SMTP_PASSWORD: get('SMTP_PASSWORD'), MAIL_FROM: get('MAIL_FROM'),
  MERCHANT_EMAIL: 'united.creative.buro@gmail.com', POLICY_TEXT,
  SHIPPING_ZONES_JSON: get('SHIPPING_ZONES_JSON') || '[]'
};
const client = new Stripe(env.STRIPE_SECRET_KEY || 'rk_test_disabled', {
  apiVersion: '2026-09-30.endive', httpClient: Stripe.createFetchHttpClient(), timeout: 10000, maxNetworkRetries: 2
});
const provider = Stripe.createSubtleCryptoProvider();
const stripe = {
  prices: client.prices, checkout: client.checkout,
  webhooks: { constructEvent: (raw: Uint8Array, signature: string, secret: string) =>
    client.webhooks.constructEventAsync(new TextDecoder().decode(raw), signature, secret, undefined, provider) }
};
const store = new SupabaseStore({ url: Deno.env.get('SUPABASE_URL'), key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') });
const transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: Number(env.SMTP_PORT),
  secure: env.SMTP_PORT !== '587', requireTLS: true, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  connectionTimeout: 10000, socketTimeout: 15000, disableFileAccess: true, disableUrlAccess: true });
Deno.serve(createEdgeHandler({ env, stripe, store, transport }));
