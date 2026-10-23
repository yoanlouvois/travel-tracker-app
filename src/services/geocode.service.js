// src/services/geocode.service.js
// Recherche de lieux par nom via Nominatim (géocodeur d'OpenStreetMap).
//
// Règles d'usage de Nominatim (serveur public) respectées ici :
// - User-Agent qui identifie l'application (NOMINATIM_USER_AGENT dans .env)
// - 1 requête par seconde maximum : les appels sont mis en file
// - résultats mis en cache : une même recherche n'est envoyée qu'une fois
// - pas d'autocomplétion à chaque frappe : le front envoie une recherche validée
//
// Nécessite Node 18+ (fetch intégré).

const prisma = require('../prisma')

const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org'
const USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'TravelMap/1.0 (application personnelle locale)'
const CONTACT_EMAIL = process.env.NOMINATIM_EMAIL || '' // recommandé par Nominatim, facultatif

const MIN_INTERVAL_MS = 1100        // un peu plus d'1 s entre deux appels
const REQUEST_TIMEOUT_MS = 10000
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 h
const CACHE_MAX_ENTRIES = 500
const DEFAULT_LIMIT = 5
const MAX_LIMIT = 10

// =================================================
// HELPERS
// =================================================
function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

// ---------- file d'attente : 1 requête / seconde ----------
let queue = Promise.resolve()
let lastCallAt = 0

function throttled(task) {
  const run = queue.then(async () => {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    lastCallAt = Date.now()
    return task()
  })
  // une erreur ne doit pas bloquer les appels suivants
  queue = run.catch(() => {})
  return run
}

// ---------- cache en mémoire (avec durée de vie et taille max) ----------
const cache = new Map() // clé -> { expiresAt, value }

function cacheGet(key) {
  const hit = cache.get(key)
  if (!hit) return null
  if (hit.expiresAt < Date.now()) {
    cache.delete(key)
    return null
  }
  return hit.value
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value) // plus ancienne entrée
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value })
}

// ---------- type suggéré pour créer un lieu ----------
// catégorie / type OpenStreetMap -> PlaceType de l'app
function suggestPlaceType(category, type) {
  if (category === 'place' && ['city', 'town', 'village', 'hamlet', 'suburb', 'quarter', 'neighbourhood'].includes(type)) return 'CITY'
  if (category === 'boundary' && type === 'administrative') return 'CITY'
  if (category === 'tourism' && type === 'viewpoint') return 'VIEWPOINT'
  if (category === 'natural' && ['peak', 'volcano', 'ridge', 'glacier', 'valley'].includes(type)) return 'HIKE'
  if (category === 'route' && ['hiking', 'foot'].includes(type)) return 'HIKE'
  if (category === 'leisure' || (category === 'tourism' && ['attraction', 'theme_park', 'zoo', 'museum', 'aquarium'].includes(type))) return 'ACTIVITY'
  return 'DEFAULT'
}

// nom court : "Kyoto" plutôt que "Kyoto, Préfecture de Kyoto, Japon"
function shortName(item) {
  return item.name || item.namedetails?.name || String(item.display_name || '').split(',')[0].trim()
}

// =================================================
// APPEL NOMINATIM
// =================================================
async function fetchNominatim(params) {
  const url = new URL('/search', NOMINATIM_URL)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
  }

  let res
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Accept-Language': 'fr,en',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw httpError(504, 'Le service de recherche de lieux ne répond pas. Réessaie plus tard.')
    }
    throw httpError(502, 'Impossible de joindre le service de recherche de lieux (connexion internet ?).')
  }

  if (res.status === 429) throw httpError(429, 'Trop de recherches d\'affilée. Attends quelques secondes.')
  if (!res.ok) throw httpError(502, `Le service de recherche de lieux a répondu une erreur (${res.status}).`)

  try {
    return await res.json()
  } catch {
    throw httpError(502, 'Réponse illisible du service de recherche de lieux.')
  }
}

// =================================================
// RECHERCHE
// =================================================
// search({ q, limit?, country? })
//   q       : texte recherché (2 caractères min)
//   limit   : nombre de résultats (1 à 10, 5 par défaut)
//   country : code ISO2 pour limiter la recherche à un pays (ex : "JP")
//
// Renvoie : [{
//   nominatimPlaceId, name, displayName, lat, lng,
//   category, osmType, suggestedType,
//   countryIso2, countryId, countryName,   // pays en base (null si inconnu)
//   bbox: [sud, nord, ouest, est] | null
// }]
async function search({ q, limit, country } = {}) {
  const query = String(q || '').trim().replace(/\s+/g, ' ')
  if (query.length < 2) throw httpError(400, 'Tape au moins 2 caractères pour rechercher un lieu.')
  if (query.length > 200) throw httpError(400, 'Recherche trop longue (200 caractères maximum).')

  const max = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT)

  let countryCode = null
  if (country) {
    if (!/^[A-Za-z]{2}$/.test(String(country))) throw httpError(400, 'Le pays doit être un code à 2 lettres (ex : FR).')
    countryCode = String(country).toLowerCase()
  }

  const cacheKey = `${query.toLowerCase()}|${max}|${countryCode || ''}`
  let raw = cacheGet(cacheKey)

  if (!raw) {
    raw = await throttled(() => fetchNominatim({
      q: query,
      format: 'jsonv2',
      addressdetails: 1,
      namedetails: 1,
      limit: max,
      countrycodes: countryCode,
      email: CONTACT_EMAIL,
    }))
    if (!Array.isArray(raw)) throw httpError(502, 'Réponse inattendue du service de recherche de lieux.')
    cacheSet(cacheKey, raw)
  }

  // pays en base, pour pouvoir créer un lieu directement (countryId)
  const iso2s = [...new Set(raw.map((item) => item.address?.country_code?.toUpperCase()).filter(Boolean))]
  const countries = iso2s.length
    ? await prisma.country.findMany({ where: { iso2: { in: iso2s } }, select: { id: true, iso2: true, name: true } })
    : []
  const countryByIso2 = new Map(countries.map((c) => [c.iso2.toUpperCase(), c]))

  return raw
    .map((item) => {
      const lat = Number(item.lat)
      const lng = Number(item.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

      const iso2 = item.address?.country_code?.toUpperCase() || null
      const dbCountry = iso2 ? countryByIso2.get(iso2) : null
      const bbox = Array.isArray(item.boundingbox) && item.boundingbox.length === 4
        ? item.boundingbox.map(Number)
        : null

      return {
        nominatimPlaceId: item.place_id != null ? String(item.place_id) : null,
        name: shortName(item),
        displayName: item.display_name || shortName(item),
        lat,
        lng,
        category: item.category || item.class || null,
        osmType: item.type || null,
        suggestedType: suggestPlaceType(item.category || item.class, item.type),
        countryIso2: iso2,
        countryId: dbCountry?.id || null,
        countryName: dbCountry?.name || item.address?.country || null,
        bbox,
      }
    })
    .filter(Boolean)
}

module.exports = {
  search,
  suggestPlaceType,
}