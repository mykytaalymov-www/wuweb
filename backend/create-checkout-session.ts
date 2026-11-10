// Supabase Edge Function draft (NOT deployed). Server-side Stripe Checkout.
// Configure STRIPE_SECRET_KEY, WU_PRICE_PLN, WU_PRICE_EUR in the function's
// secret store. Use test keys + test prices for staging, live keys + live
// prices only after end-to-end verification. Do not commit secrets.
//
// POST JSON: { country: "PL" | "DE", size: "S-M" | "M-L", quantity: 1 }
// The browser cannot set prices, tax, delivery or success URLs.
const origin = "https://wuisthequestion.com";
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Content-Type": "application/json"
};
const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (request.headers.get("origin") !== origin) return json(403, { error: "invalid_origin" });
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 1024) return json(413, { error: "request_too_large" });

  let payload: { country?: unknown; size?: unknown; quantity?: unknown };
  try { payload = await request.json(); }
  catch { return json(400, { error: "invalid_json" }); }
  const { country, size, quantity } = payload;
  if ((country !== "PL" && country !== "DE") ||
      (size !== "S-M" && size !== "M-L") ||
      quantity !== 1) return json(400, { error: "invalid_order" });

  const key = Deno.env.get("STRIPE_SECRET_KEY");
  const pricePL = Deno.env.get("WU_PRICE_PLN");
  const priceDE = Deno.env.get("WU_PRICE_EUR");
  if (!key || !pricePL || !priceDE) return json(503, { error: "checkout_unavailable" });

  // These are totals fixed server-side and independent of browser-side estimates.
  const currency = country === "PL" ? "pln" : "eur";
  const amount = country === "PL" ? 2900 : 1900;
  const price = country === "PL" ? pricePL : priceDE;
  const fields = new URLSearchParams();
  fields.set("mode", "payment");
  fields.set("line_items[0][price]", price);
  fields.set("line_items[0][quantity]", "1");
  fields.set("shipping_address_collection[allowed_countries][0]", country);
  fields.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
  fields.set("shipping_options[0][shipping_rate_data][display_name]", "Courier delivery");
  fields.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(amount));
  fields.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", currency);
  fields.set("shipping_options[0][shipping_rate_data][tax_behavior]", "inclusive");
  fields.set("shipping_options[0][shipping_rate_data][tax_code]", "txcd_92010001");
  fields.set("automatic_tax[enabled]", "false");
  fields.set("client_reference_id", `rrose_${size.replace("-", "").toLowerCase()}_${country.toLowerCase()}`);
  fields.set("metadata[sku]", "RROSE");
  fields.set("metadata[size]", size);
  fields.set("metadata[shipping_country]", country);
  fields.set("customer_creation", "always");
  fields.set("success_url", origin + "/?checkout_return=success&session_id={CHECKOUT_SESSION_ID}");
  fields.set("cancel_url", origin + "/?checkout_return=cancel");

  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: fields.toString()
    });
    const result = await response.json();
    if (!response.ok || typeof result.url !== "string")
      return json(502, { error: "stripe_checkout_failed" });
    return json(200, { url: result.url });
  } catch {
    return json(502, { error: "stripe_unreachable" });
  }
});
