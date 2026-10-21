// src/services/trips.service.js
const prisma = require('../prisma')

const STOPS_INCLUDE = {
  stops: {
    orderBy: { orderIndex: 'asc' },
    include: { place: true }
  }
}

// =================================================
// HELPERS
// =================================================
function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

// Prisma lève P2025 quand update/delete ne trouve pas l'enregistrement
function mapNotFound(err, what) {
  if (err?.code === 'P2025') return httpError(404, `${what} not found`)
  return err
}

// null / '' -> null, sinon Date valide
function toDateOrNull(value) {
  if (value == null || value === '') return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw httpError(400, `Invalid date: ${value}`)
  return d
}

// undefined -> on ne touche pas au champ ; null / '' -> on l'efface
function optionalDate(value) {
  return value === undefined ? undefined : toDateOrNull(value)
}

function toNumberOrNull(value, field) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) throw httpError(400, `${field} must be a number`)
  return n
}

// Données d'un stop : si placeId est fourni, on recopie nom / coordonnées
// du lieu quand ils ne sont pas fournis (le stop reste affichable si le
// lieu est supprimé plus tard).
async function resolveStopData(tx, data = {}) {
  const placeId = data.placeId ?? null
  let title = data.title || null
  let lat = toNumberOrNull(data.lat, 'lat')
  let lng = toNumberOrNull(data.lng, 'lng')

  if (placeId) {
    const place = await tx.place.findUnique({
      where: { id: placeId },
      select: { name: true, lat: true, lng: true }
    })
    if (!place) throw httpError(400, `Invalid placeId: ${placeId}`)

    if (!title) title = place.name
    if (lat == null) lat = place.lat
    if (lng == null) lng = place.lng
  }

  if (!placeId && (lat == null || lng == null)) {
    throw httpError(400, 'A stop needs a placeId or lat/lng')
  }

  return { placeId, title, lat, lng }
}

async function assertTripExists(tx, tripId) {
  const trip = await tx.trip.findUnique({ where: { id: tripId }, select: { id: true } })
  if (!trip) throw httpError(404, 'Trip not found')
}

// Décale de `delta` l'orderIndex des stops de `tripId` dont l'orderIndex est
// dans `range` (filtre Prisma), sans violer @@unique([tripId, orderIndex]).
// SQLite vérifie l'unicité ligne par ligne : un simple increment sur
// 2,3,4 peut tenter de mettre 2 -> 3 alors que 3 existe encore.
// On passe donc par des valeurs négatives, toutes distinctes :
//   k -> -k -> -(k + delta) -> k + delta
// (aucun stop n'a d'index négatif en dehors de cette opération)
async function shiftStops(tx, tripId, range, delta) {
  await tx.tripStop.updateMany({
    where: { tripId, orderIndex: range },
    data: { orderIndex: { multiply: -1 } }
  })
  await tx.tripStop.updateMany({
    where: { tripId, orderIndex: { lt: 0 } },
    data: { orderIndex: { decrement: delta } }
  })
  await tx.tripStop.updateMany({
    where: { tripId, orderIndex: { lt: 0 } },
    data: { orderIndex: { multiply: -1 } }
  })
}

async function getMaxOrderIndex(tx, tripId) {
  const last = await tx.tripStop.findFirst({
    where: { tripId },
    orderBy: { orderIndex: 'desc' },
    select: { orderIndex: true }
  })
  return last ? last.orderIndex : 0
}

// =================================================
// TRIPS
// =================================================

// -----------------------------
// LIST
// -----------------------------
async function list() {
  return prisma.trip.findMany({
    orderBy: [{ startDate: 'desc' }, { name: 'asc' }],
    include: STOPS_INCLUDE
  })
}

// -----------------------------
// GET BY ID
// -----------------------------
async function getById(id) {
  if (!id) throw httpError(400, 'Trip id is required')

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: STOPS_INCLUDE
  })

  if (!trip) throw httpError(404, 'Trip not found')
  return trip
}

// -----------------------------
// CREATE TRIP (+ stops optionnels, en une transaction)
// body: { name, description?, startDate?, endDate?, stops?: [{ placeId?, title?, lat?, lng? }] }
// -----------------------------
async function create(data = {}) {
  const name = String(data.name || '').trim()
  if (!name) throw httpError(400, 'Trip name is required')

  const stops = Array.isArray(data.stops) ? data.stops : []

  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.create({
      data: {
        name,
        description: data.description || null,
        startDate: toDateOrNull(data.startDate),
        endDate: toDateOrNull(data.endDate)
      }
    })

    for (let i = 0; i < stops.length; i++) {
      const stop = await resolveStopData(tx, stops[i])
      await tx.tripStop.create({
        data: { tripId: trip.id, ...stop, orderIndex: i + 1 }
      })
    }

    return tx.trip.findUnique({ where: { id: trip.id }, include: STOPS_INCLUDE })
  })
}

// -----------------------------
// UPDATE TRIP
// champs absents = inchangés ; startDate/endDate à null = effacés
// -----------------------------
async function update(id, data = {}) {
  if (!id) throw httpError(400, 'Trip id is required')

  const updateData = {}

  if (data.name !== undefined) {
    const name = String(data.name || '').trim()
    if (!name) throw httpError(400, 'Trip name cannot be empty')
    updateData.name = name
  }
  if (data.description !== undefined) updateData.description = data.description || null
  if (data.startDate !== undefined) updateData.startDate = optionalDate(data.startDate)
  if (data.endDate !== undefined) updateData.endDate = optionalDate(data.endDate)

  try {
    return await prisma.trip.update({
      where: { id },
      data: updateData,
      include: STOPS_INCLUDE
    })
  } catch (err) {
    throw mapNotFound(err, 'Trip')
  }
}

// -----------------------------
// DELETE TRIP (les stops partent en cascade)
// -----------------------------
async function remove(id) {
  if (!id) throw httpError(400, 'Trip id is required')

  try {
    return await prisma.trip.delete({ where: { id } })
  } catch (err) {
    throw mapNotFound(err, 'Trip')
  }
}

// =================================================
// TRIP STOPS
// =================================================

// -----------------------------
// Ajouter un stop
// orderIndex absent => à la fin ; fourni => insertion (les suivants sont décalés)
// -----------------------------
async function addStop(tripId, data = {}) {
  if (!tripId) throw httpError(400, 'Trip id is required')

  return prisma.$transaction(async (tx) => {
    await assertTripExists(tx, tripId)

    const stop = await resolveStopData(tx, data)
    const maxIndex = await getMaxOrderIndex(tx, tripId)

    let orderIndex = maxIndex + 1

    if (data.orderIndex != null) {
      const wanted = Number(data.orderIndex)
      if (!Number.isInteger(wanted) || wanted < 1) {
        throw httpError(400, 'orderIndex must be an integer >= 1')
      }
      orderIndex = Math.min(wanted, maxIndex + 1)

      // on libère la place
      if (orderIndex <= maxIndex) {
        await shiftStops(tx, tripId, { gte: orderIndex }, +1)
      }
    }

    return tx.tripStop.create({
      data: { tripId, ...stop, orderIndex }
    })
  })
}

// -----------------------------
// Déplacer un stop à un index cible
// tx optionnel pour réutiliser dans updateStop
// -----------------------------
async function moveStop(stopId, targetIndex, txParam) {
  const run = async (tx) => {
    if (!Number.isInteger(targetIndex) || targetIndex < 1) {
      throw httpError(400, 'targetIndex must be an integer >= 1')
    }

    const stop = await tx.tripStop.findUnique({
      where: { id: stopId },
      select: { id: true, tripId: true, orderIndex: true }
    })
    if (!stop) throw httpError(404, 'Stop not found')

    const { tripId, orderIndex: from } = stop
    const maxIndex = await getMaxOrderIndex(tx, tripId)
    const to = Math.min(targetIndex, maxIndex) // pas de trou en fin de liste
    if (from === to) return stop

    // on libère l'unique avec un index temporaire (0 : jamais utilisé)
    await tx.tripStop.update({ where: { id: stopId }, data: { orderIndex: 0 } })

    if (to < from) {
      // vers le haut : [to .. from-1] => +1
      await shiftStops(tx, tripId, { gte: to, lt: from }, +1)
    } else {
      // vers le bas : [from+1 .. to] => -1
      await shiftStops(tx, tripId, { gt: from, lte: to }, -1)
    }

    return tx.tripStop.update({ where: { id: stopId }, data: { orderIndex: to } })
  }

  return txParam ? run(txParam) : prisma.$transaction(run)
}

// -----------------------------
// Modifier un stop
// - orderIndex différent => moveStop
// - placeId changé => title/lat/lng recopiés depuis le lieu si non fournis
// -----------------------------
async function updateStop(stopId, data = {}) {
  if (!stopId) throw httpError(400, 'Stop id is required')

  return prisma.$transaction(async (tx) => {
    const current = await tx.tripStop.findUnique({
      where: { id: stopId },
      select: { id: true, orderIndex: true }
    })
    if (!current) throw httpError(404, 'Stop not found')

    if (data.orderIndex != null && Number(data.orderIndex) !== current.orderIndex) {
      await moveStop(stopId, Number(data.orderIndex), tx)
    }

    const updateData = {}
    if (data.title !== undefined) updateData.title = data.title || null
    if (data.lat !== undefined) updateData.lat = toNumberOrNull(data.lat, 'lat')
    if (data.lng !== undefined) updateData.lng = toNumberOrNull(data.lng, 'lng')
    if (data.placeId !== undefined) updateData.placeId = data.placeId || null

    if (data.placeId) {
      const place = await tx.place.findUnique({
        where: { id: data.placeId },
        select: { name: true, lat: true, lng: true }
      })
      if (!place) throw httpError(400, `Invalid placeId: ${data.placeId}`)

      if (updateData.title === undefined) updateData.title = place.name
      if (updateData.lat === undefined) updateData.lat = place.lat
      if (updateData.lng === undefined) updateData.lng = place.lng
    }

    return tx.tripStop.update({
      where: { id: stopId },
      data: updateData,
      include: { place: true }
    })
  })
}

// Monter / descendre (helpers)
async function moveUp(stopId) {
  const stop = await prisma.tripStop.findUnique({
    where: { id: stopId },
    select: { orderIndex: true }
  })
  if (!stop) throw httpError(404, 'Stop not found')
  if (stop.orderIndex <= 1) return stop
  return moveStop(stopId, stop.orderIndex - 1)
}

async function moveDown(stopId) {
  const stop = await prisma.tripStop.findUnique({
    where: { id: stopId },
    select: { orderIndex: true }
  })
  if (!stop) throw httpError(404, 'Stop not found')
  return moveStop(stopId, stop.orderIndex + 1)
}

// -----------------------------
// Supprimer un stop (et refermer le trou)
// -----------------------------
async function removeStop(stopId) {
  if (!stopId) throw httpError(400, 'Stop id is required')

  return prisma.$transaction(async (tx) => {
    const stop = await tx.tripStop.findUnique({
      where: { id: stopId },
      select: { tripId: true, orderIndex: true }
    })
    if (!stop) throw httpError(404, 'Stop not found')

    await tx.tripStop.delete({ where: { id: stopId } })
    await shiftStops(tx, stop.tripId, { gt: stop.orderIndex }, -1)

    return { ok: true }
  })
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  addStop,
  updateStop,
  removeStop,
  moveStop,
  moveUp,
  moveDown
}