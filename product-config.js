// Public display information. Stripe-hosted links enforce price, quantity and delivery country.
window.RROSE_CONFIG = {
  instagramUrl: 'https://www.instagram.com/wuisthequestion/',
  sizes: ['S-M', 'M-L'],
  prices: { short: { EUR: 160, PLN: 699 }, long: { EUR: 160, PLN: 699 } },
  checkoutMode: 'hosted',
  checkoutLinks: {
    PL: 'https://buy.stripe.com/dRm6oHfN5bXi1pXeJp67S00',
    DE: 'https://buy.stripe.com/6oU4gz6cvf9u8Sp9p567S01',
    EU: 'https://buy.stripe.com/7sY28rfN5d1m9WtfNt67S02',
    NEAR: 'https://buy.stripe.com/aFa7sL7gzd1m3y51WD67S03',
    EUROPE_EXT: 'https://buy.stripe.com/dRmbJ1eJ12mI7OlgRx67S04'
  },
  // Public HTTPS backend origin only. Empty until Sandbox and Live verification pass.
  checkoutApi: '',
  parcel: { weightKg: 1, dimensionsCm: { length: 35, width: 30, height: 10 }, volumetricDivisor: 5000 },
  shipping: {
    demoOnly: false,
    // These country lists match the restrictions enforced by each existing Live link.
    zones: {
      PL: ['PL'], DE: ['DE'],
      EU: 'AT BE BG HR CY CZ DK EE FI FR GR HU IE IT LV LT LU MT NL PT RO SK SI ES SE'.split(' '),
      NEAR: ['GB', 'NO', 'CH'],
      EUROPE_EXT: 'AL AD BA GI GG GL IM IS JE LI MC MD ME MK RS SM TR VA XK'.split(' ')
    },
    rates: {
      PL: { PLN: 29, route: 'courier / Poland' },
      DE: { EUR: 19, route: 'courier / Germany' },
      EU: { EUR: 49, route: 'tracked courier / European Union' },
      NEAR: { EUR: 99, route: 'tracked courier / UK, Norway, Switzerland', importFees: true },
      EUROPE_EXT: { EUR: 369, route: 'tracked courier / extended Europe', importFees: true }
    }
  },
  maxItemsPerOrder: 1
};
