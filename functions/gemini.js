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

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'demo-openguessr'
const VERTEX_AI_LOCATION = process.env.VERTEX_AI_LOCATION || 'europe-west1'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
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

const SYSTEM_PROMPT = `You are a geography expert generating locations for a GeoGuessr-style game.

Your task is to generate random street-level coordinates from around the world that have Google Street View coverage.

## RULES
- Spread locations across different countries and continents
- Mix urban, suburban, and rural locations
- AVOID famous landmarks, tourist attractions, and instantly recognizable places
- Prefer residential streets, local roads, small towns, and ordinary neighbourhoods
- Each location must be on an actual road or street (not ocean, forest, or desert)
- Coordinates must be realistic and precise (6 decimal places)
- Country codes must be valid ISO 3166-1 alpha-2 (uppercase)

## OUTPUT FORMAT
Return ONLY a valid JSON array with no markdown fencing:
[{"lat": number, "lng": number, "country": "XX"}]`

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
      parts: [{ text: `Generate ${count} random street-level locations for a geography guessing game. Follow all rules in your instructions.` }]
    }],
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    generationConfig: {
      temperature: 1.0,
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
