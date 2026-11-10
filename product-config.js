// WU? RROSE: fixed-price country checkout. Staged only; main stays untouched.
window.RROSE_CONFIG = {
  instagramUrl: 'https://www.instagram.com/wuisthequestion/',
  sizes: ['S-M', 'M-L'],
  prices: { short: { EUR: 160, PLN: 699 }, long: { EUR: 160, PLN: 699 } },
  stripePaymentLink: null,
  checkoutLinks: {
    PL: 'https://buy.stripe.com/dRm6oHfN5bXi1pXeJp67S00',
    DE: 'https://buy.stripe.com/6oU4gz6cvf9u8Sp9p567S01'
  },
  parcel: { weightKg: 1, dimensionsCm: { length: 35, width: 30, height: 10 }, volumetricDivisor: 5000 },
  shipping: {
    demoOnly: false,
    rates: {
      PL: { PLN: 29, route: 'courier / Poland' },
      DE: { EUR: 19, route: 'courier / Germany' }
    }
  },
  maxItemsPerOrder: 1
};
