import { DatabaseSync } from 'node:sqlite';

export class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, fingerprint TEXT NOT NULL,
        quote TEXT NOT NULL, created INTEGER NOT NULL, session_id TEXT UNIQUE, checkout_url TEXT,
        status TEXT NOT NULL DEFAULT 'pending', customer TEXT, payment_intent TEXT
      );
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, processed INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY, order_id TEXT NOT NULL, sent INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt INTEGER NOT NULL DEFAULT 0
      );`);
  }
  get(id) { return this.db.prepare('SELECT * FROM orders WHERE id=?').get(id); }
  create(o) {
    this.db.prepare('INSERT OR IGNORE INTO orders(id,token_hash,fingerprint,quote,created) VALUES (?,?,?,?,?)')
      .run(o.id, o.tokenHash, o.fingerprint, JSON.stringify(o.quote), o.created);
    return this.get(o.id);
  }
  attach(id, session) {
    this.db.prepare('UPDATE orders SET session_id=?, checkout_url=? WHERE id=?').run(session.id, session.url, id);
  }
  apply(event, order, session, status) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.db.prepare('SELECT id FROM events WHERE id=?').get(event.id)) { this.db.exec('COMMIT'); return; }
      const current = this.get(order.id);
      // Paid is terminal for Checkout events: late failure/expiry cannot undo it.
      if (current.status !== 'paid' && !(current.status === 'failed' && status === 'pending')) {
        this.db.prepare('UPDATE orders SET status=?, session_id=COALESCE(session_id,?), customer=?, payment_intent=? WHERE id=?')
          .run(status, session.id, JSON.stringify({ ...session.customer_details,
            shipping: session.collected_information?.shipping_details || session.shipping_details }),
          typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null, order.id);
        if (status === 'paid') this.db.prepare('INSERT OR IGNORE INTO outbox(id,order_id) VALUES (?,?)').run(`paid:${order.id}`, order.id);
      }
      this.db.prepare('INSERT INTO events(id,processed) VALUES (?,?)').run(event.id, Date.now());
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  claimMail() { return this.db.prepare('SELECT * FROM outbox WHERE sent IS NULL AND next_attempt<=? LIMIT 20').all(Date.now()); }
  mailSent(job) { this.db.prepare('UPDATE outbox SET sent=? WHERE id=?').run(Date.now(), job.id); }
  mailRetry(job, next) { this.db.prepare('UPDATE outbox SET attempts=attempts+1, next_attempt=? WHERE id=?').run(next, job.id); }
  close() { this.db.close(); }
}
