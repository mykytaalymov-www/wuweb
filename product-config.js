// Public display information. The backend independently validates every payable amount.
window.RROSE_CONFIG = {
  instagramUrl: 'https://www.instagram.com/wuisthequestion/',
  sizes: ['S-M', 'M-L'],
  prices: { short: { EUR: 160, PLN: 699 }, long: { EUR: 160, PLN: 699 } },
  stripePaymentLink: null,
  // Public HTTPS backend origin only. Empty until Sandbox and Live verification pass.
  checkoutApi: '',
  parcel: { weightKg: 1, dimensionsCm: { length: 35, width: 30, height: 10 }, volumetricDivisor: 5000 },
  shipping: {
    demoOnly: false,
    rates: {
      PL: { PLN: 29, route: 'courier / Poland' },
      DE: { EUR: 19, route: 'courier / Germany' }
    }
  },
  maxItemsPerOrder: 20
};
