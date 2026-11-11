// Persistent outbox; one worker per database. Stable Message-ID aids deduplication.
// SMTP cannot guarantee exactly-once delivery if a process dies after server acceptance.
export async function drainMail(store, transport, env) {
  const pending = store.db.prepare('SELECT * FROM outbox WHERE sent IS NULL AND next_attempt<=? LIMIT 20').all(Date.now());
  for (const job of pending) {
    const order = store.get(job.order_id), customer = JSON.parse(order.customer), q = JSON.parse(order.quote);
    const text = `Payment confirmed — WU? order ${order.id}\n` +
      q.items.map(i => `RROSE ${i.size}: ${i.quantity}`).join('\n') +
      `\nItems: ${(q.subtotal / 100).toFixed(2)} ${q.currency.toUpperCase()}` +
      `\nDelivery: ${(q.shipping / 100).toFixed(2)} ${q.currency.toUpperCase()}` +
      `\nTotal paid (VAT included): ${(q.total / 100).toFixed(2)} ${q.currency.toUpperCase()}` +
      `\nDelivery address: ${JSON.stringify(customer.shipping)}` +
      `\nWe will email dispatch information separately.\nTerms and returns: ${env.STOREFRONT_ORIGIN}/policies.html` +
      '\nUNITED CREATIVE BÜRO SP. Z O.O. | NIP 5223386453 | KRS 0001271341' +
      '\nAl. Jerozolimskie 81 / 7.10, 02-001 Warszawa, Polska' +
      '\nSupport and returns: united.creative.buro@gmail.com';
    try {
      await transport.sendMail({ from: env.MAIL_FROM, to: { address: customer.email }, bcc: { address: env.MERCHANT_EMAIL },
        messageId: `<wu-paid-${order.id}@wuisthequestion.com>`, subject: `WU? payment confirmed — ${order.id}`, text,
        attachments: [{ filename: 'terms-and-returns.txt', content: env.POLICY_TEXT }] });
      store.db.prepare('UPDATE outbox SET sent=? WHERE id=?').run(Date.now(), job.id);
    } catch {
      const delay = Math.min(3600_000, 30000 * 2 ** Math.min(job.attempts, 7));
      store.db.prepare('UPDATE outbox SET attempts=attempts+1, next_attempt=? WHERE id=?').run(Date.now() + delay, job.id);
      console.error('Order confirmation delivery failed; queued for retry');
    }
  }
}
