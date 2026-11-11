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
    EUROPE_EXT: 'https://buy.stripe.com/dRmbJ1eJ12mI7OlgRx67S04',
    WORLD: 'https://buy.stripe.com/4gM00j6cvf9u7Ol0Sz67S07'
  },
  // Exact size combinations are enforced in Stripe, with two skirts and one delivery.
  bundleCheckoutLinks: {
    "EUROPE_EXT": {
      "sm2ml0": "https://buy.stripe.com/00w4gz30jf9u2u1cBh67S08",
      "sm1ml1": "https://buy.stripe.com/7sY3cv44nbXi3y5fNt67S09",
      "sm0ml2": "https://buy.stripe.com/6oU6oH30j1iE0lT6cT67S0a"
    },
    "NEAR": {
      "sm2ml0": "https://buy.stripe.com/00weVd44ngdy7Ol8l167S0b",
      "sm1ml1": "https://buy.stripe.com/28E9AT30j3qM3y5fNt67S0c",
      "sm0ml2": "https://buy.stripe.com/aFadR97gz9Pa1pX7gX67S0d"
    },
    "EU": {
      "sm2ml0": "https://buy.stripe.com/4gM6oHfN59Pa1pX6cT67S0e",
      "sm1ml1": "https://buy.stripe.com/dRm7sL0Sb1iE7Ol6cT67S0f",
      "sm0ml2": "https://buy.stripe.com/bJeaEX0Sb2mI5Gd58P67S0g"
    },
    "DE": {
      "sm2ml0": "https://buy.stripe.com/14A6oHgR9aTe2u10Sz67S0h",
      "sm1ml1": "https://buy.stripe.com/28EeVdeJ10eA0lT7gX67S0i",
      "sm0ml2": "https://buy.stripe.com/cNieVdgR95yU3y5dFl67S0j"
    },
    "PL": {
      "sm2ml0": "https://buy.stripe.com/6oUeVdbwPgdyfgN7gX67S0k",
      "sm1ml1": "https://buy.stripe.com/eVq9ATeJ14uQc4B9p567S0l",
      "sm0ml2": "https://buy.stripe.com/fZudR99oH8L63y5eJp67S0m"
    },
    "WORLD": {
      "sm2ml0": "https://buy.stripe.com/9B6cN5eJ1f9u6Kh6cT67S0n",
      "sm1ml1": "https://buy.stripe.com/5kQ28r6cv4uQb0x30H67S0o",
      "sm0ml2": "https://buy.stripe.com/4gM00jdEXe5qgkR58P67S0p"
    }
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
      EUROPE_EXT: 'AL AD BA GI GG GL IM IS JE LI MC MD ME MK RS SM TR VA XK'.split(' '),
      WORLD: 'AE AG AI AM AO AR AU AW AZ BB BD BF BH BI BJ BL BM BN BO BQ BR BS BT BW BZ CA CD CF CG CI CK CL CM CN CO CR CV CW DJ DM DO DZ EC EG ER ET FJ FK FO GA GD GE GF GH GM GN GP GQ GT GU GW GY HK HN HT ID IL IN IQ JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LK LR LS LY MA MG ML MM MN MO MQ MR MS MU MV MW MX MY MZ NA NC NE NG NI NP NR NU NZ OM PA PE PF PG PH PK PR PY QA RE RW SA SB SC SD SG SH SL SN SR SS ST SV SX SZ TC TD TG TH TJ TL TM TN TO TT TV TW TZ UG US UY UZ VC VE VG VN VU WS YE YT ZM ZW'.split(' ')
    },
    rates: {
      PL: { PLN: 29, route: 'courier / Poland' },
      DE: { EUR: 19, route: 'courier / Germany' },
      EU: { EUR: 49, route: 'tracked courier / European Union' },
      NEAR: { EUR: 99, route: 'tracked courier / UK, Norway, Switzerland', importFees: true },
      EUROPE_EXT: { EUR: 369, route: 'tracked courier / extended Europe', importFees: true },
      WORLD: { EUR: 60, route: 'international delivery', importFees: true }
    }
  },
  // Merchant confirmed on 2026-11-11: the same fixed delivery covers up to two skirts.
  maxItemsPerOrder: 2
};
