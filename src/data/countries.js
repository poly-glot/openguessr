export const continents = {
  'North America': [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'MX', name: 'Mexico' },
    { code: 'GT', name: 'Guatemala' },
    { code: 'CU', name: 'Cuba' },
    { code: 'DO', name: 'Dominican Republic' },
    { code: 'HN', name: 'Honduras' },
    { code: 'CR', name: 'Costa Rica' },
    { code: 'PA', name: 'Panama' },
    { code: 'JM', name: 'Jamaica' },
    { code: 'PR', name: 'Puerto Rico' }
  ],
  'South America': [
    { code: 'BR', name: 'Brazil' },
    { code: 'CO', name: 'Colombia' },
    { code: 'AR', name: 'Argentina' },
    { code: 'PE', name: 'Peru' },
    { code: 'VE', name: 'Venezuela' },
    { code: 'CL', name: 'Chile' },
    { code: 'EC', name: 'Ecuador' },
    { code: 'BO', name: 'Bolivia' },
    { code: 'PY', name: 'Paraguay' },
    { code: 'UY', name: 'Uruguay' }
  ],
  'Europe': [
    { code: 'GB', name: 'United Kingdom' },
    { code: 'FR', name: 'France' },
    { code: 'DE', name: 'Germany' },
    { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' },
    { code: 'PT', name: 'Portugal' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'BE', name: 'Belgium' },
    { code: 'SE', name: 'Sweden' },
    { code: 'NO', name: 'Norway' },
    { code: 'DK', name: 'Denmark' },
    { code: 'FI', name: 'Finland' },
    { code: 'PL', name: 'Poland' },
    { code: 'CZ', name: 'Czech Republic' },
    { code: 'AT', name: 'Austria' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'IE', name: 'Ireland' },
    { code: 'GR', name: 'Greece' },
    { code: 'RO', name: 'Romania' },
    { code: 'HU', name: 'Hungary' },
    { code: 'HR', name: 'Croatia' },
    { code: 'RS', name: 'Serbia' },
    { code: 'UA', name: 'Ukraine' },
    { code: 'RU', name: 'Russia' },
    { code: 'TR', name: 'Turkey' },
    { code: 'IS', name: 'Iceland' },
    { code: 'EE', name: 'Estonia' },
    { code: 'LV', name: 'Latvia' },
    { code: 'LT', name: 'Lithuania' },
    { code: 'BG', name: 'Bulgaria' },
    { code: 'SK', name: 'Slovakia' },
    { code: 'SI', name: 'Slovenia' },
    { code: 'AL', name: 'Albania' }
  ],
  'Asia': [
    { code: 'CN', name: 'China' },
    { code: 'JP', name: 'Japan' },
    { code: 'KR', name: 'South Korea' },
    { code: 'IN', name: 'India' },
    { code: 'ID', name: 'Indonesia' },
    { code: 'TH', name: 'Thailand' },
    { code: 'VN', name: 'Vietnam' },
    { code: 'PH', name: 'Philippines' },
    { code: 'MY', name: 'Malaysia' },
    { code: 'SG', name: 'Singapore' },
    { code: 'KH', name: 'Cambodia' },
    { code: 'BD', name: 'Bangladesh' },
    { code: 'PK', name: 'Pakistan' },
    { code: 'LK', name: 'Sri Lanka' },
    { code: 'NP', name: 'Nepal' },
    { code: 'MN', name: 'Mongolia' },
    { code: 'KZ', name: 'Kazakhstan' },
    { code: 'GE', name: 'Georgia' },
    { code: 'IL', name: 'Israel' },
    { code: 'JO', name: 'Jordan' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'SA', name: 'Saudi Arabia' },
    { code: 'TW', name: 'Taiwan' },
    { code: 'HK', name: 'Hong Kong' }
  ],
  'Africa': [
    { code: 'ZA', name: 'South Africa' },
    { code: 'NG', name: 'Nigeria' },
    { code: 'EG', name: 'Egypt' },
    { code: 'KE', name: 'Kenya' },
    { code: 'GH', name: 'Ghana' },
    { code: 'TZ', name: 'Tanzania' },
    { code: 'UG', name: 'Uganda' },
    { code: 'SN', name: 'Senegal' },
    { code: 'MA', name: 'Morocco' },
    { code: 'TN', name: 'Tunisia' },
    { code: 'BW', name: 'Botswana' },
    { code: 'RW', name: 'Rwanda' }
  ],
  'Oceania': [
    { code: 'AU', name: 'Australia' },
    { code: 'NZ', name: 'New Zealand' },
    { code: 'FJ', name: 'Fiji' },
    { code: 'PG', name: 'Papua New Guinea' }
  ]
}

// world-borders.geojson uses "United States of America", "Republic of Serbia",
// and "United Republic of Tanzania". Map our short names to the geojson names
// so guess-map can find the polygon to fly to.
export const GEO_NAME_ALIASES = {
  US: 'United States of America',
  RS: 'Republic of Serbia',
  TZ: 'United Republic of Tanzania'
}

// City-states / dependencies the geojson does not carry as separate features.
// Fall back to a hardcoded centre + zoom for these.
export const COUNTRY_CENTROIDS = {
  SG: { lat: 1.3521, lng: 103.8198, zoom: 10 },
  HK: { lat: 22.3193, lng: 114.1694, zoom: 10 }
}

// Sprite path is bundled alongside the app (see scripts/build-flag-sprite.js).
// Use it via <svg><use href={getFlagUrl('US')}/></svg>.
export const FLAG_SPRITE_URL = '/assets/flags-sprite.svg'

export function getFlagUrl (code) {
  return `${FLAG_SPRITE_URL}#flag-${code.toLowerCase()}`
}

const _byCode = new Map()
for (const [continent, countries] of Object.entries(continents)) {
  for (const c of countries) _byCode.set(c.code, { ...c, continent })
}

export function getCountryByCode (code) {
  return _byCode.get(code) || null
}

let _sortedCache = null
export function getAllCountriesSorted () {
  if (_sortedCache) return _sortedCache
  const all = []
  for (const [continent, countries] of Object.entries(continents)) {
    for (const c of countries) all.push({ ...c, continent })
  }
  all.sort((a, b) => a.name.localeCompare(b.name))
  _sortedCache = all
  return all
}
