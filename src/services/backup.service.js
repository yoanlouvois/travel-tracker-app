// src/services/backup.service.js
// Export / import de toute la base en JSON.
//
// FORMAT (version 1)
// {
//   version: 1,
//   exportedAt: "2026-10-23T10:00:00.000Z",
//   countries: [{ iso2, visited, toVisit, uiCoverImagePath }],         // seulement les pays "renseignés"
//   places:    [{ id, countryIso2, name, description, type, visited, visitedAt,
//                 lat, lng, source, nominatimPlaceId, nominatimName,
//                 media: [{ id, mediaType, filePath, caption, takenAt, sortOrder }] }],
//   trips:     [{ id, name, description, startDate, endDate,
//                 stops: [{ placeId, title, lat, lng, orderIndex }] }],
//   vlogs:     [{ id, title, urlOrPath, date, description, countries: ["JP", ...] }]
// }
// Les liens vers les pays passent par iso2 (les id Prisma changent d'une base à l'autre).
//
// IMPORT = FUSION ("seulement ce qui est en plus")
// - Pays     : jamais créés (seed). On ajoute seulement un statut : visité / à visiter,
//              jamais retiré. Couverture copiée seulement si le pays n'en a pas.
// - Lieux    : déjà présent si même id, ou même pays + même nom + à moins de ~100 m.
// - Médias   : déjà présent si même id, ou même lieu + même filePath.
// - Roadtrips: déjà présent si même id, ou même nom + même date de début.
// - Vlogs    : déjà présent si même id, ou même titre + date + lien.
// Ce qui existe déjà n'est jamais modifié.
// Tout ou rien : le fichier est validé entièrement avant d'écrire, puis tout est
// écrit dans une seule transaction (la moindre erreur annule tout).

const prisma = require('../prisma')

const FORMAT_VERSION = 1
const PLACE_TYPES = ['DEFAULT', 'CITY', 'HIKE', 'ACTIVITY', 'VIEWPOINT']
const GEO_SOURCES = ['MANUAL', 'NOMINATIM']
const MEDIA_TYPES = ['PHOTO', 'VIDEO']

// =================================================
// HELPERS
// =================================================
function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

function invalid(path, message) {
  return httpError(400, `Fichier invalide : ${path} ${message}`)
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

function reqString(obj, key, path) {
  const v = obj[key]
  if (typeof v !== 'string' || !v.trim()) throw invalid(`${path}.${key}`, 'est obligatoire (texte)')
  return v.trim()
}

function optString(obj, key, path) {
  const v = obj[key]
  if (v === undefined || v === null || v === '') return null
  if (typeof v !== 'string') throw invalid(`${path}.${key}`, 'doit être un texte')
  return v
}

function optId(obj, key, path) {
  const v = optString(obj, key, path)
  return v ? v.trim() : null
}

function reqNumber(obj, key, path, min, max) {
  const v = obj[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) throw invalid(`${path}.${key}`, 'doit être un nombre')
  if (v < min || v > max) throw invalid(`${path}.${key}`, `doit être entre ${min} et ${max}`)
  return v
}

function optNumber(obj, key, path, min, max) {
  if (obj[key] === undefined || obj[key] === null) return null
  return reqNumber(obj, key, path, min, max)
}

function optBool(obj, key, path) {
  const v = obj[key]
  if (v === undefined || v === null) return false
  if (typeof v !== 'boolean') throw invalid(`${path}.${key}`, 'doit être true ou false')
  return v
}

function optDate(obj, key, path) {
  const v = obj[key]
  if (v === undefined || v === null || v === '') return null
  const d = new Date(v)
  if (typeof v !== 'string' || Number.isNaN(d.getTime())) throw invalid(`${path}.${key}`, 'doit être une date')
  return d
}

function reqDate(obj, key, path) {
  const d = optDate(obj, key, path)
  if (!d) throw invalid(`${path}.${key}`, 'est obligatoire (date)')
  return d
}

function reqEnum(obj, key, path, values, fallback) {
  const v = obj[key] ?? fallback
  if (!values.includes(v)) throw invalid(`${path}.${key}`, `doit valoir ${values.join(', ')}`)
  return v
}

function optArray(obj, key, path) {
  const v = obj[key]
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) throw invalid(`${path}.${key}`, 'doit être une liste')
  return v
}

function iso2Of(value, path) {
  if (typeof value !== 'string' || !/^[A-Za-z]{2}$/.test(value.trim())) {
    throw invalid(path, 'doit être un code pays à 2 lettres (ex : "FR")')
  }
  return value.trim().toUpperCase()
}

const norm = (s) => String(s ?? '').trim().toLowerCase()
const dateKey = (d) => (d ? new Date(d).toISOString() : '')

// même lieu si même pays + même nom + coordonnées à moins de ~0.001° (≈ 100 m)
const COORD_TOLERANCE = 0.001
const placeNameKey = (countryId, name) => `${countryId}|${norm(name)}`
const isNear = (a, b) => Math.abs(a.lat - b.lat) < COORD_TOLERANCE && Math.abs(a.lng - b.lng) < COORD_TOLERANCE
const tripKey = (name, startDate) => `${norm(name)}|${dateKey(startDate)}`
const vlogKey = (title, date, urlOrPath) => `${norm(title)}|${dateKey(date)}|${String(urlOrPath).trim()}`

// =================================================
// EXPORT
// =================================================
async function exportAll() {
  const [countries, places, trips, vlogs] = await Promise.all([
    // les autres pays sont dans leur état par défaut : inutile de les exporter
    prisma.country.findMany({
      where: { OR: [{ visited: true }, { toVisit: true }, { uiCoverImagePath: { not: null } }] },
      orderBy: { iso2: 'asc' },
    }),
    prisma.place.findMany({
      orderBy: { name: 'asc' },
      include: {
        country: { select: { iso2: true } },
        media: { orderBy: { sortOrder: 'asc' } },
      },
    }),
    prisma.trip.findMany({
      orderBy: { name: 'asc' },
      include: { stops: { orderBy: { orderIndex: 'asc' } } },
    }),
    prisma.vlog.findMany({
      orderBy: { date: 'asc' },
      include: { countryVlogs: { include: { country: { select: { iso2: true } } } } },
    }),
  ])

  return {
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),

    countries: countries.map((c) => ({
      iso2: c.iso2,
      visited: c.visited,
      toVisit: c.toVisit,
      uiCoverImagePath: c.uiCoverImagePath,
    })),

    places: places.map((p) => ({
      id: p.id,
      countryIso2: p.country.iso2,
      name: p.name,
      description: p.description,
      type: p.type,
      visited: p.visited,
      visitedAt: p.visitedAt,
      lat: p.lat,
      lng: p.lng,
      source: p.source,
      nominatimPlaceId: p.nominatimPlaceId,
      nominatimName: p.nominatimName,
      media: p.media.map((m) => ({
        id: m.id,
        mediaType: m.mediaType,
        filePath: m.filePath,
        caption: m.caption,
        takenAt: m.takenAt,
        sortOrder: m.sortOrder,
      })),
    })),

    trips: trips.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      startDate: t.startDate,
      endDate: t.endDate,
      stops: t.stops.map((s) => ({
        placeId: s.placeId,
        title: s.title,
        lat: s.lat,
        lng: s.lng,
        orderIndex: s.orderIndex,
      })),
    })),

    vlogs: vlogs.map((v) => ({
      id: v.id,
      title: v.title,
      urlOrPath: v.urlOrPath,
      date: v.date,
      description: v.description,
      countries: v.countryVlogs.map((cv) => cv.country.iso2),
    })),
  }
}

// =================================================
// IMPORT : 1) validation complète (avant toute écriture)
// =================================================
function parseBackup(data) {
  if (!isObject(data)) throw httpError(400, 'Fichier invalide : un objet JSON est attendu.')
  if (data.version !== FORMAT_VERSION) {
    throw httpError(400, `Version de fichier non prise en charge (${data.version ?? 'absente'}), version attendue : ${FORMAT_VERSION}.`)
  }

  const countries = optArray(data, 'countries', 'racine').map((c, i) => {
    const path = `countries[${i}]`
    if (!isObject(c)) throw invalid(path, 'doit être un objet')
    return {
      iso2: iso2Of(c.iso2, `${path}.iso2`),
      visited: optBool(c, 'visited', path),
      toVisit: optBool(c, 'toVisit', path),
      uiCoverImagePath: optString(c, 'uiCoverImagePath', path),
    }
  })

  const places = optArray(data, 'places', 'racine').map((p, i) => {
    const path = `places[${i}]`
    if (!isObject(p)) throw invalid(path, 'doit être un objet')
    return {
      id: optId(p, 'id', path),
      countryIso2: iso2Of(p.countryIso2, `${path}.countryIso2`),
      name: reqString(p, 'name', path),
      description: optString(p, 'description', path),
      type: reqEnum(p, 'type', path, PLACE_TYPES),
      visited: optBool(p, 'visited', path),
      visitedAt: optDate(p, 'visitedAt', path),
      lat: reqNumber(p, 'lat', path, -90, 90),
      lng: reqNumber(p, 'lng', path, -180, 180),
      source: reqEnum(p, 'source', path, GEO_SOURCES, 'MANUAL'),
      nominatimPlaceId: optString(p, 'nominatimPlaceId', path),
      nominatimName: optString(p, 'nominatimName', path),
      media: optArray(p, 'media', path).map((m, j) => {
        const mPath = `${path}.media[${j}]`
        if (!isObject(m)) throw invalid(mPath, 'doit être un objet')
        return {
          id: optId(m, 'id', mPath),
          mediaType: reqEnum(m, 'mediaType', mPath, MEDIA_TYPES, 'PHOTO'),
          filePath: reqString(m, 'filePath', mPath),
          caption: optString(m, 'caption', mPath),
          takenAt: optDate(m, 'takenAt', mPath),
          sortOrder: Number.isInteger(m.sortOrder) ? m.sortOrder : j,
        }
      }),
    }
  })

  const trips = optArray(data, 'trips', 'racine').map((t, i) => {
    const path = `trips[${i}]`
    if (!isObject(t)) throw invalid(path, 'doit être un objet')
    const stops = optArray(t, 'stops', path).map((s, j) => {
      const sPath = `${path}.stops[${j}]`
      if (!isObject(s)) throw invalid(sPath, 'doit être un objet')
      return {
        placeId: optId(s, 'placeId', sPath),
        title: optString(s, 'title', sPath),
        lat: optNumber(s, 'lat', sPath, -90, 90),
        lng: optNumber(s, 'lng', sPath, -180, 180),
        orderIndex: Number.isFinite(s.orderIndex) ? s.orderIndex : j + 1,
      }
    })
    // ordre d'origine conservé, index renumérotés 1..n à l'écriture
    stops.sort((a, b) => a.orderIndex - b.orderIndex)

    return {
      id: optId(t, 'id', path),
      name: reqString(t, 'name', path),
      description: optString(t, 'description', path),
      startDate: optDate(t, 'startDate', path),
      endDate: optDate(t, 'endDate', path),
      stops,
    }
  })

  const vlogs = optArray(data, 'vlogs', 'racine').map((v, i) => {
    const path = `vlogs[${i}]`
    if (!isObject(v)) throw invalid(path, 'doit être un objet')
    return {
      id: optId(v, 'id', path),
      title: reqString(v, 'title', path),
      urlOrPath: reqString(v, 'urlOrPath', path),
      date: reqDate(v, 'date', path),
      description: optString(v, 'description', path) ?? '',
      countries: [...new Set(optArray(v, 'countries', path).map((c, j) => iso2Of(c, `${path}.countries[${j}]`)))],
    }
  })

  return { countries, places, trips, vlogs }
}

// =================================================
// IMPORT : 2) fusion dans une transaction
// =================================================
async function importAll(data) {
  const backup = parseBackup(data)

  const report = {
    countries: { updated: 0, unchanged: 0 },
    places: { added: 0, skipped: 0 },
    media: { added: 0, skipped: 0 },
    trips: { added: 0, skipped: 0 },
    vlogs: { added: 0, skipped: 0 },
  }

  await prisma.$transaction(async (tx) => {
    // ---------- pays : statut + couverture ----------
    const dbCountries = await tx.country.findMany()
    const countryByIso2 = new Map(dbCountries.map((c) => [c.iso2.toUpperCase(), c]))

    function countryIdOf(iso2, path) {
      const country = countryByIso2.get(iso2)
      if (!country) throw httpError(400, `Pays inconnu "${iso2}" (${path}). Lance le seed des pays avant l'import.`)
      return country.id
    }

    for (const [i, c] of backup.countries.entries()) {
      countryIdOf(c.iso2, `countries[${i}]`)
      const current = countryByIso2.get(c.iso2)
      const changes = {}

      // on ajoute un statut, on n'en retire jamais ; "visité" l'emporte sur "à visiter"
      if (c.visited && !current.visited) {
        changes.visited = true
        changes.toVisit = false
      } else if (c.toVisit && !current.visited && !current.toVisit) {
        changes.toVisit = true
      }

      // couverture seulement si le pays n'en a pas
      if (c.uiCoverImagePath && !current.uiCoverImagePath) {
        changes.uiCoverImagePath = c.uiCoverImagePath
      }

      if (Object.keys(changes).length) {
        await tx.country.update({ where: { id: current.id }, data: changes })
        Object.assign(current, changes)
        report.countries.updated++
      } else {
        report.countries.unchanged++
      }
    }

    // ---------- lieux + médias ----------
    const dbPlaces = await tx.place.findMany({ select: { id: true, countryId: true, name: true, lat: true, lng: true } })
    const placeIds = new Set(dbPlaces.map((p) => p.id))

    // pays + nom -> [{ id, lat, lng }] (plusieurs lieux peuvent porter le même nom)
    const placesByName = new Map()
    function rememberPlace(countryId, name, id, lat, lng) {
      const key = placeNameKey(countryId, name)
      if (!placesByName.has(key)) placesByName.set(key, [])
      placesByName.get(key).push({ id, lat, lng })
    }
    function findSamePlace(countryId, name, lat, lng) {
      const candidates = placesByName.get(placeNameKey(countryId, name)) || []
      return candidates.find((c) => isNear(c, { lat, lng }))?.id
    }
    for (const p of dbPlaces) rememberPlace(p.countryId, p.name, p.id, p.lat, p.lng)

    const dbMedia = await tx.media.findMany({ select: { id: true, placeId: true, filePath: true } })
    const mediaIds = new Set(dbMedia.map((m) => m.id))
    const mediaKeys = new Set(dbMedia.map((m) => `${m.placeId}|${m.filePath}`))

    // id du lieu dans le fichier -> id du lieu en base (pour les étapes de roadtrip)
    const placeIdMap = new Map()

    for (const [i, p] of backup.places.entries()) {
      const countryId = countryIdOf(p.countryIso2, `places[${i}].countryIso2`)
      let targetId = (p.id && placeIds.has(p.id)) ? p.id : findSamePlace(countryId, p.name, p.lat, p.lng)

      if (targetId) {
        report.places.skipped++
      } else {
        const created = await tx.place.create({
          data: {
            ...(p.id ? { id: p.id } : {}),
            countryId,
            name: p.name,
            description: p.description,
            type: p.type,
            visited: p.visited,
            visitedAt: p.visitedAt,
            lat: p.lat,
            lng: p.lng,
            source: p.source,
            nominatimPlaceId: p.nominatimPlaceId,
            nominatimName: p.nominatimName,
          },
        })
        targetId = created.id
        placeIds.add(targetId)
        rememberPlace(countryId, p.name, targetId, p.lat, p.lng)
        report.places.added++
      }

      if (p.id) placeIdMap.set(p.id, targetId)

      // médias : ajoutés aussi aux lieux déjà présents s'ils manquent
      for (const m of p.media) {
        const mKey = `${targetId}|${m.filePath}`
        if ((m.id && mediaIds.has(m.id)) || mediaKeys.has(mKey)) {
          report.media.skipped++
          continue
        }
        const createdMedia = await tx.media.create({
          data: {
            ...(m.id ? { id: m.id } : {}),
            placeId: targetId,
            mediaType: m.mediaType,
            filePath: m.filePath,
            caption: m.caption,
            takenAt: m.takenAt,
            sortOrder: m.sortOrder,
          },
        })
        mediaIds.add(createdMedia.id)
        mediaKeys.add(mKey)
        report.media.added++
      }
    }

    // ---------- roadtrips + étapes ----------
    const dbTrips = await tx.trip.findMany({ select: { id: true, name: true, startDate: true } })
    const tripIds = new Set(dbTrips.map((t) => t.id))
    const tripKeys = new Set(dbTrips.map((t) => tripKey(t.name, t.startDate)))

    for (const t of backup.trips) {
      const key = tripKey(t.name, t.startDate)
      if ((t.id && tripIds.has(t.id)) || tripKeys.has(key)) {
        report.trips.skipped++
        continue
      }

      const trip = await tx.trip.create({
        data: {
          ...(t.id ? { id: t.id } : {}),
          name: t.name,
          description: t.description,
          startDate: t.startDate,
          endDate: t.endDate,
        },
      })

      // étape -> lieu : via le fichier, sinon un lieu déjà en base avec ce même id,
      // sinon point libre (titre + coordonnées conservés)
      for (const [j, s] of t.stops.entries()) {
        let placeId = null
        if (s.placeId) placeId = placeIdMap.get(s.placeId) ?? (placeIds.has(s.placeId) ? s.placeId : null)

        await tx.tripStop.create({
          data: {
            tripId: trip.id,
            placeId,
            title: s.title,
            lat: s.lat,
            lng: s.lng,
            orderIndex: j + 1,
          },
        })
      }

      tripIds.add(trip.id)
      tripKeys.add(key)
      report.trips.added++
    }

    // ---------- vlogs + pays liés ----------
    const dbVlogs = await tx.vlog.findMany({ select: { id: true, title: true, date: true, urlOrPath: true } })
    const vlogIds = new Set(dbVlogs.map((v) => v.id))
    const vlogKeys = new Set(dbVlogs.map((v) => vlogKey(v.title, v.date, v.urlOrPath)))

    for (const [i, v] of backup.vlogs.entries()) {
      const key = vlogKey(v.title, v.date, v.urlOrPath)
      if ((v.id && vlogIds.has(v.id)) || vlogKeys.has(key)) {
        report.vlogs.skipped++
        continue
      }

      const countryIds = v.countries.map((iso2, j) => countryIdOf(iso2, `vlogs[${i}].countries[${j}]`))

      const vlog = await tx.vlog.create({
        data: {
          ...(v.id ? { id: v.id } : {}),
          title: v.title,
          urlOrPath: v.urlOrPath,
          date: v.date,
          description: v.description,
          countryVlogs: { create: countryIds.map((countryId) => ({ countryId })) },
        },
      })

      vlogIds.add(vlog.id)
      vlogKeys.add(key)
      report.vlogs.added++
    }
  }, {
    // une grosse sauvegarde peut dépasser les 5 s par défaut de Prisma
    maxWait: 10000,
    timeout: 120000,
  })

  return report
}

module.exports = {
  FORMAT_VERSION,
  exportAll,
  importAll,
}