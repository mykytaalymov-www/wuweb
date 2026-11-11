// The service-role credential is supplied only by Supabase's server environment.
// RPCs are revoked from PUBLIC/anon/authenticated; tables live in a private schema.
export class SupabaseStore {
  constructor({ url, key, fetcher = fetch }) { Object.assign(this, { url, key, fetcher }); }
  async rpc(name, args = {}) {
    const response = await this.fetcher(`${this.url}/rest/v1/rpc/wu_staging_${name}`, {
      method: 'POST', headers: { apikey: this.key, Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error('Order database unavailable');
    return response.json();
  }
  normalize(order) { return order ? { ...order, quote: JSON.stringify(order.quote), customer: order.customer ? JSON.stringify(order.customer) : null } : null; }
  async get(id) { if (!id) return null; return this.normalize(await this.rpc('order_get', { p_id: id })); }
  async create(o) {
    return this.normalize(await this.rpc('order_create', { p_id: o.id, p_token_hash: o.tokenHash,
      p_fingerprint: o.fingerprint, p_quote: o.quote, p_created: o.created }));
  }
  attach(id, session) { return this.rpc('order_attach', { p_id: id, p_session_id: session.id, p_url: session.url }); }
  apply(event, order, session, status) { return this.rpc('event_apply', {
    p_event: event.id, p_order: order.id, p_session: session, p_status: status
  }); }
  claimMail() { return this.rpc('mail_claim'); }
  mailSent(job) { return this.rpc('mail_finish', { p_id: job.id, p_claim: job.claim_token, p_next: null }); }
  mailRetry(job, next) { return this.rpc('mail_finish', { p_id: job.id, p_claim: job.claim_token, p_next: next }); }
  health() { return this.rpc('health'); }
  rateLimit(key) { return this.rpc('rate_limit', { p_key: key }); }
  mailPending(id) { return this.rpc('mail_pending', { p_order: id }); }
}
