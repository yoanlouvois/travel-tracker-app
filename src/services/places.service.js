// src/services/places.service.js
const prisma = require('../prisma')
const { removePublicFiles, removeDirIfEmpty } = require('../upload/files')

const PLACE_TYPES = ['DEFAULT', 'CITY', 'HIKE', 'ACTIVITY', 'VIEWPOINT']
const GEO_SOURCES = ['MANUAL', 'NOMINATIM']

function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

// Prisma lève P2025 quand update/delete ne trouve pas l'enregistrement
function mapNotFound(err) {
  if (err?.code === 'P2025') return httpError(404, 'Place not found')
  return err
}

function assertType(type) {
  if (!PLACE_TYPES.includes(type)) {
    throw httpError(400, `Invalid type "${type}" (expected one of ${PLACE_TYPES.join(', ')})`)
  }
}

function toNumber(value, field) {
  const n = Number(value)
  if (!Number.isFinite(n)) throw httpError(400, `${field} must be a number`)
  return n
}

// -------- LIST --------
// Options: { countryId, type, visited }
async function list({ countryId, type, visited } = {}) {
  const where = {}

  if (countryId) where.countryId = countryId
  if (type) where.type = type
  if (visited !== undefined) where.visited = visited

  return prisma.place.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      country: true,
      media: true
    }
  })
}

// -------- GET BY ID --------
async function getById(id) {
  if (!id) throw httpError(400, 'Place id is required')

  const place = await prisma.place.findUnique({
    where: { id },
    include: {
      country: true,
      media: true,
      tripStops: true
    }
  })

  if (!place) throw httpError(404, 'Place not found')

  return place
}

// -------- CREATE --------
async function create(data = {}) {
  const {
    name,
    countryId,
    lat,
    lng,
    type,
    description,
    visited,
    visitedAt,
    source,
    nominatimPlaceId,
    nominatimName
  } = data

  if (!name || !countryId || lat == null || lng == null || !type) {
    throw httpError(400, 'name, countryId, lat, lng and type are required')
  }

  assertType(type)

  if (source !== undefined && !GEO_SOURCES.includes(source)) {
    throw httpError(400, `Invalid source "${source}"`)
  }

  const countryExists = await prisma.country.findUnique({
    where: { id: countryId }
  })

  if (!countryExists) throw httpError(400, 'Invalid countryId')

  return prisma.place.create({
    data: {
      name,
      countryId,
      lat: toNumber(lat, 'lat'),
      lng: toNumber(lng, 'lng'),
      type,
      description,
      visited: visited ?? false,
      visitedAt: visitedAt ? new Date(visitedAt) : null,
      source: source ?? 'MANUAL',
      nominatimPlaceId,
      nominatimName
    },
    include: {
      country: true,
      media: true
    }
  })
}

// -------- UPDATE --------
async function update(id, data = {}) {
  if (!id) throw httpError(400, 'Place id is required')

  const updateData = {}

  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.type !== undefined) {
    assertType(data.type)
    updateData.type = data.type
  }
  if (data.lat !== undefined) updateData.lat = toNumber(data.lat, 'lat')
  if (data.lng !== undefined) updateData.lng = toNumber(data.lng, 'lng')
  if (data.visited !== undefined) updateData.visited = !!data.visited
  if (data.visitedAt !== undefined) {
    updateData.visitedAt = data.visitedAt ? new Date(data.visitedAt) : null
  }

  try {
    return await prisma.place.update({
      where: { id },
      data: updateData,
      include: {
        country: true,
        media: true
      }
    })
  } catch (err) {
    throw mapNotFound(err)
  }
}

// -------- DELETE --------
// Le lieu est retiré des roadtrips qui passent par lui :
// - ses étapes sont supprimées et les étapes restantes renumérotées 1..n
// - un roadtrip qui n'a plus que 0 ou 1 étape est supprimé (plus de tracé)
// Les Media sont supprimés en cascade en base ; leurs fichiers sont ensuite
// supprimés du disque (avec le dossier uploads/places/<id> s'il est vide).
async function remove(id) {
  if (!id) throw httpError(400, 'Place id is required')

  let mediaPaths = []

  const deleted = await prisma.$transaction(async (tx) => {
    const place = await tx.place.findUnique({
      where: { id },
      include: {
        tripStops: { select: { tripId: true } },
        media: { select: { filePath: true } }
      }
    })

    if (!place) throw httpError(404, 'Place not found')
    mediaPaths = place.media.map((m) => m.filePath)

    const tripIds = [...new Set(place.tripStops.map((s) => s.tripId))]

    await tx.tripStop.deleteMany({ where: { placeId: id } })

    for (const tripId of tripIds) {
      const stops = await tx.tripStop.findMany({
        where: { tripId },
        orderBy: { orderIndex: 'asc' },
        select: { id: true }
      })

      if (stops.length < 2) {
        await tx.trip.delete({ where: { id: tripId } }) // stops restants en cascade
        continue
      }

      // renumérotation sans violer @@unique([tripId, orderIndex]) :
      // d'abord -1..-n (aucune collision avec les index positifs), puis 1..n
      for (let i = 0; i < stops.length; i++) {
        await tx.tripStop.update({
          where: { id: stops[i].id },
          data: { orderIndex: -(i + 1) }
        })
      }
      await tx.tripStop.updateMany({
        where: { tripId, orderIndex: { lt: 0 } },
        data: { orderIndex: { multiply: -1 } }
      })
    }

    return tx.place.delete({ where: { id } })
  })

  // fichiers supprimés seulement une fois la base à jour
  await removePublicFiles(mediaPaths)
  await removeDirIfEmpty(`/uploads/places/${id}`)

  return deleted
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove
}