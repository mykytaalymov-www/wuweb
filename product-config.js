// Public product information and clearly labelled demonstration rates.
// Replace the demo shipping table with a live carrier quote before launch.
window.RROSE_CONFIG = {
  instagramUrl: 'https://www.instagram.com/wuisthequestion/',
  sizes: ['S-M', 'M-L'],
  prices: {
    short: { EUR: 160, PLN: 699 },
    long: { EUR: 160, PLN: 699 }
  },
  checkoutLinks: { short: {}, long: {} },
  parcel: {
    weightKg: 1,
    dimensionsCm: { length: 60, width: 60, height: 30 },
    volumetricDivisor: 5000
  },
  shipping: {
    demoOnly: true,
    rates: {
      PL: { EUR: 12, PLN: 49, route: 'inpost courier / demo' },
      EU: { EUR: 35, PLN: 149, route: 'international courier / demo' },
      GB: { EUR: 55, PLN: 235, route: 'international courier / demo' },
      WORLD: { EUR: 75, PLN: 319, route: 'international courier / demo' }
    }
  }
};
