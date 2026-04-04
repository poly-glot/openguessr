/**
 * Gemini AI service for generating random Street View locations.
 *
 * In production: Calls Vertex AI Gemini API to generate coordinates,
 *                then validates Street View coverage via Maps metadata API.
 * In local dev:  Falls back to static locations list (no Vertex AI credentials).
 *
 * Follows the same REST API pattern as hooklab (webhook project) for
 * cross-region Vertex AI access with GCP metadata server tokens.
 */

const { locations } = require('./locations')

// ── Config ────────────────────────────────────────────────────────

const PROJECT_ID = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-openguessr'
const VERTEX_AI_LOCATION = process.env.VERTEX_AI_LOCATION || 'europe-west2'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || ''
const GCP_METADATA_TOKEN_URL = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token'
const TOKEN_CACHE_BUFFER = 60_000

const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true'

// ── Access token (cached) ─────────────────────────────────────────

let cachedToken = null

async function getAccessToken () {
  if (cachedToken && cachedToken.expiresAt > Date.now() + TOKEN_CACHE_BUFFER) {
    return cachedToken.token
  }
  const res = await fetch(GCP_METADATA_TOKEN_URL, {
    headers: { 'Metadata-Flavor': 'Google' }
  })
  if (!res.ok) throw new Error(`Failed to get access token: ${res.status}`)
  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000
  }
  return cachedToken.token
}

// ── Gemini prompt ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `You generate street-level coordinates for a GeoGuessr-style guessing game.

## TASK
Produce random coordinates that are on real roads with Google Street View coverage. Each batch must be geographically diverse and unpredictable.

## GEOGRAPHIC DISTRIBUTION
Each batch of N locations MUST include coordinates from at least 4 of these 6 regions, and MUST NOT repeat the same country more than twice:
- Americas: US, CA, MX, BR, AR, CL, CO, PE, UY, EC, CR, GT, DO
- Europe West: GB, FR, DE, ES, IT, PT, NL, BE, IE, CH, AT, SE, NO, DK, FI, IS
- Europe East: PL, CZ, RO, HU, HR, RS, BG, SK, SI, EE, LV, LT, UA, AL, GE, TR
- Asia-Pacific: JP, KR, TW, TH, VN, PH, ID, MY, SG, KH, IN, LK, BD, MN, NP
- Middle East & Africa: ZA, KE, GH, NG, SN, BW, UG, RW, MA, TN, EG, IL, JO, AE, SA
- Oceania: AU, NZ, FJ, PG

## LOCATION QUALITY
- Place coordinates on named roads, residential streets, or local highways -- NOT on highways between cities, bodies of water, forests, or empty land
- Think of a specific real town or neighbourhood first, then produce coordinates within it
- Vary the setting: include some small towns (population < 50,000), some suburban areas, and some city side streets
- NEVER use coordinates near: Eiffel Tower, Times Square, Sydney Opera House, Big Ben, Colosseum, Christ the Redeemer, Taj Mahal, Great Wall, or any top-100 tourist attraction
- Coordinates must have 6 decimal places of precision (approx 0.1 metre)

## STREET VIEW COVERAGE HINTS
Countries with extensive coverage (prefer these): US, GB, FR, DE, JP, AU, BR, MX, ES, IT, CZ, PL, RO, ZA, TH, ID, PH, KR, TW, NL, SE, NO, FI, DK, IE, PT, CH, AT, NZ, CA, AR, CL, CO, PE, UY
Countries with partial coverage (use sparingly): IN, RU, TR, EG, MA, KE, GH, NG, BD, UA, HR, RS, BG, HU, SK, SI, EE, LV, LT, AL, GE, KH, VN, MY, SG, MN
Countries with very limited coverage (avoid): CN, KZ, PK, SA, most of central Africa

## OUTPUT
Return a JSON array. Each object: {"lat": number, "lng": number, "country": "XX"}
- "country" is the ISO 3166-1 alpha-2 code (uppercase) for the country the coordinate is in
- lat range: -90 to 90, lng range: -180 to 180`

// ── Location generation ───────────────────────────────────────────

/**
 * Generates a batch of random Street View locations using Gemini.
 * Validates each coordinate has Street View coverage.
 * Falls back to static locations in emulator mode.
 *
 * @param {number} count - Number of locations to generate
 * @returns {Promise<Array<{lat: number, lng: number, country: string}>>}
 */
async function generateLocations (count = 50) {
  if (isEmulator || !GOOGLE_MAPS_API_KEY) {
    console.log('Emulator mode or no Maps API key — using static locations')
    return shuffleArray([...locations]).slice(0, count)
  }

  try {
    const raw = await callGemini(count)
    const parsed = parseGeminiResponse(raw)

    if (!parsed || parsed.length === 0) {
      console.warn('Gemini returned no parseable locations, falling back to static')
      return shuffleArray([...locations]).slice(0, count)
    }

    const validated = await validateStreetViewCoverage(parsed)
    console.log(`Gemini generated ${parsed.length} locations, ${validated.length} have Street View coverage`)

    if (validated.length === 0) {
      console.warn('No Gemini locations passed Street View validation, falling back to static')
      return shuffleArray([...locations]).slice(0, count)
    }

    return validated
  } catch (err) {
    console.error('Gemini location generation failed:', err.message)
    return shuffleArray([...locations]).slice(0, count)
  }
}

async function callGemini (count) {
  const token = await getAccessToken()
  const url = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${VERTEX_AI_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`

  const body = {
    contents: [{
      role: 'user',
      parts: [{ text: `Generate ${count} street-level locations. Pick countries you have NOT used recently. Surprise me -- include at least 3 countries that most people would not expect in a geography game.` }]
    }],
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json'
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error (${res.status}): ${err}`)
  }

  const result = await res.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned empty response')
  return text
}

function parseGeminiResponse (text) {
  try {
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return null
    const arr = JSON.parse(match[0])
    return arr.filter(loc =>
      typeof loc.lat === 'number' &&
      typeof loc.lng === 'number' &&
      typeof loc.country === 'string' &&
      loc.country.length === 2 &&
      loc.lat >= -90 && loc.lat <= 90 &&
      loc.lng >= -180 && loc.lng <= 180
    )
  } catch {
    return null
  }
}

// ── Street View validation ────────────────────────────────────────

async function validateStreetViewCoverage (locations) {
  const validated = []

  // Process in batches of 10 to avoid rate limits
  for (let i = 0; i < locations.length; i += 10) {
    const batch = locations.slice(i, i + 10)
    const results = await Promise.all(batch.map(async (loc) => {
      try {
        const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${loc.lat},${loc.lng}&radius=1000&key=${GOOGLE_MAPS_API_KEY}`
        const res = await fetch(url)
        const data = await res.json()

        if (data.status === 'OK' && data.location) {
          return {
            lat: data.location.lat,
            lng: data.location.lng,
            country: loc.country.toUpperCase()
          }
        }
        return null
      } catch {
        return null
      }
    }))

    validated.push(...results.filter(Boolean))
  }

  return validated
}

// ── Utility ───────────────────────────────────────────────────────

function shuffleArray (arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

module.exports = { generateLocations, shuffleArray }
