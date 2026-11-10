// Draft configuration for Live Stripe Checkout. Not published on main.
// Prices are VAT-inclusive. Shipping is charged once per order.
// Enable only after the backend is deployed, secrets configured and end-to-end tests pass.
window.WU_LIVE_CHECKOUT = {
  enabled: false,
  endpoint: "",
  currencyByCountry: { PL: "PLN", DE: "EUR" },
  priceIdByCurrency: {
    PLN: "price_1UaGzgHv7Ryf9QPajobbmb7t",
    EUR: "price_1UaGziHv7Ryf9QPa2wcb62JL"
  },
  shipping: {
    PL: { currency: "PLN", amount: 29, label: "Courier delivery — Poland" },
    DE: { currency: "EUR", amount: 19, label: "Courier delivery — Germany" }
  },
  // Only one skirt until the courier package dimensions/price for multi-item orders are verified.
  maxItemsPerOrder: 1
};
