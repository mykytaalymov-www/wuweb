export const PRODUCT = 'prod_VbTxAjvibHelD7';
export const PRICES = {
  pln: { id: 'price_1UaGzgHv7Ryf9QPajobbmb7t', amount: 69900 },
  eur: { id: 'price_1UaGziHv7Ryf9QPa2wcb62JL', amount: 16000 }
};
export class Problem extends Error {
  constructor(status, code) { super(code); this.status = status; }
}
export const zones = [
  { id: 'PL', countries: ['PL'], currency: 'pln', amount: 2900, source: 'Merchant approved fixed order rate' },
  { id: 'DE', countries: ['DE'], currency: 'eur', amount: 1900, source: 'Merchant approved fixed order rate' },
  { id: 'EU', countries: ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','GR','HU','IE','IT','LV','LT','LU','MT','NL','PT','RO','SK','SI','ES','SE'], currency: 'eur', amount: null },
  { id: 'NEAR', countries: ['GB','NO','CH'], currency: 'eur', amount: null },
  { id: 'WORLD', countries: [], currency: 'eur', amount: null }
];

export function shippingZones(env) {
  // Only replace the table with operator-reviewed, country-specific evidence.
  // Non-EU routes additionally require customs clearance approval. No fallback rate.
  const extra = env.SHIPPING_ZONES_JSON ? JSON.parse(env.SHIPPING_ZONES_JSON) : [];
  if (!Array.isArray(extra)) throw new Error('Invalid shipping zones');
  const seen = new Set(['PL', 'DE']);
  for (const z of extra) {
    if (!z.id || !Array.isArray(z.countries) || !z.countries.length || z.currency !== 'eur' ||
        !Number.isSafeInteger(z.amount) || z.amount < 0 || !z.source || !z.approvedAt ||
        !Number.isFinite(Date.parse(z.validUntil)) || Date.parse(z.validUntil) <= Date.now() ||
        z.customsReviewed !== true || !Number.isInteger(z.maxItems) || z.maxItems < 1 || z.maxItems > 20)
      throw new Error('Unapproved shipping zone');
    for (const c of z.countries) {
      if (!/^[A-Z]{2}$/.test(c) || seen.has(c)) throw new Error('Duplicate/invalid shipping country');
      seen.add(c);
    }
  }
  return [...zones.slice(0, 2), ...extra];
}

export function quote(input, env = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(k => !['country','items'].includes(k))) throw new Problem(400, 'invalid_order');
  const { country, items } = input;
  if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) throw new Problem(400, 'invalid_country');
  if (!Array.isArray(items) || !items.length || items.length > 2) throw new Problem(400, 'invalid_items');
  const counts = new Map();
  for (const item of items) {
    if (!item || Object.keys(item).some(k => !['size','quantity'].includes(k)) ||
        !['S-M', 'M-L'].includes(item.size) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)
      throw new Problem(400, 'invalid_items');
    counts.set(item.size, (counts.get(item.size) || 0) + item.quantity);
  }
  const normalized = [...counts].sort().map(([size, quantity]) => ({ size, quantity }));
  const quantity = normalized.reduce((n, i) => n + i.quantity, 0);
  if (quantity > 20) throw new Problem(400, 'too_many_items');
  const zone = shippingZones(env).find(z => z.countries.includes(country));
  if (!zone) throw new Problem(422, 'shipping_unavailable');
  const maxItems = zone.maxItems || Number(env.PACKAGE_MAX_ITEMS || 1);
  if (quantity > maxItems) throw new Problem(422, 'packing_confirmation_required');
  const price = PRICES[zone.currency];
  return { country, items: normalized, quantity, currency: zone.currency, unitAmount: price.amount,
    subtotal: price.amount * quantity, shipping: zone.amount, total: price.amount * quantity + zone.amount,
    zone: zone.id, rateSource: zone.source, vatIncluded: true,
    parcel: { dimensionsCm: [35,30,10], actualWeightKg: quantity, dimensionalWeightKg: 2.1,
      estimatedChargeableWeightKg: Math.max(quantity, 2.1), divisor: 5000 } };
}
