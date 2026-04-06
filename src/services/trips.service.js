const prisma = require('../prisma')

// -----------------------------
// LIST
// -----------------------------
async function list() {
  return prisma.trip.findMany({
    orderBy: { startDate: 'desc' },
    include: {
      stops: {
        orderBy: { orderIndex: 'asc' },
        include: {
          place: true
        }
      }
    }
  })
}

// -----------------------------
// GET BY ID
// -----------------------------
async function getById(id) {
  if (!id) throw new Error('Trip id is required')

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      stops: {
        orderBy: { orderIndex: 'asc' },
        include: { place: true }
      }
    }
  })

  if (!trip) throw new Error('Trip not found')
  return trip
}

// -----------------------------
// CREATE TRIP
// -----------------------------
async function create(data) {
  if (!data?.name) throw new Error('Trip name is required')

  return prisma.trip.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null
    }
  })
}

// -----------------------------
// UPDATE TRIP
// -----------------------------
async function update(id, data) {
  if (!id) throw new Error('Trip id is required')

  return prisma.trip.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined
    }
  })
}

// -----------------------------
// DELETE TRIP
// -----------------------------
async function remove(id) {
  if (!id) throw new Error('Trip id is required')

  return prisma.trip.delete({
    where: { id }
  })
}

// =================================================
// TRIP STOPS
// =================================================


async function getNextOrderIndex(tripId) {
  const last = await prisma.tripStop.findFirst({
    where: { tripId },
    orderBy: { orderIndex: 'desc' },
    select: { orderIndex: true }
  })
  return last ? last.orderIndex + 1 : 1
}

// Décale tous les stops >= fromIndex de +delta (delta = +1 typiquement)
async function shiftStops(tripId, fromIndex, delta, tx) {
  // SQLite + Prisma: updateMany supporte "increment"
  return tx.tripStop.updateMany({
    where: { tripId, orderIndex: { gte: fromIndex } },
    data: { orderIndex: { increment: delta } }
  })
}

// -----------------------------
// Ajouter un stop (smart)
// -----------------------------
async function addStop(tripId, data) {
  if (!tripId) throw new Error('Trip id is required')

  return prisma.$transaction(async (tx) => {
    let title = data.title ?? null
    let lat = data.lat ?? null
    let lng = data.lng ?? null
    let placeId = data.placeId ?? null

    // Si placeId fourni => on copie infos de Place (si pas déjà fournies)
    if (placeId) {
      const place = await tx.place.findUnique({
        where: { id: placeId },
        select: { name: true, lat: true, lng: true }
      })
      if (!place) throw new Error('Invalid placeId')

      if (!title) title = place.name
      if (lat == null) lat = place.lat
      if (lng == null) lng = place.lng
    }

    // orderIndex : auto si absent
    let orderIndex =
      data.orderIndex == null ? await getNextOrderIndex(tripId) : Number(data.orderIndex)

    if (!Number.isInteger(orderIndex) || orderIndex < 1) {
      throw new Error('orderIndex must be an integer >= 1')
    }

    // Si index imposé, on décale les autres pour faire de la place
    // (sinon contrainte UNIQUE cassera)
    if (data.orderIndex != null) {
      await shiftStops(tripId, orderIndex, +1, tx)
    }

    return tx.tripStop.create({
      data: { tripId, placeId, title, lat, lng, orderIndex }
    })
  })
}

// -----------------------------
// Modifier un stop (sans reorder complexe)
// - si tu changes placeId, on peut re-copier title/lat/lng si non fournis
// - si tu changes orderIndex => on passe par moveStop
// -----------------------------
async function updateStop(stopId, data) {
  if (!stopId) throw new Error('Stop id is required')

  return prisma.$transaction(async (tx) => {
    const current = await tx.tripStop.findUnique({
      where: { id: stopId },
      select: { id: true, tripId: true, orderIndex: true }
    })
    if (!current) throw new Error('Stop not found')

    // Si on veut changer l'ordre => utilise moveStop
    if (data.orderIndex != null && data.orderIndex !== current.orderIndex) {
      await moveStop(stopId, Number(data.orderIndex), tx)
      // puis on continue update des autres champs si besoin
    }

    const updateData = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.lat !== undefined) updateData.lat = data.lat
    if (data.lng !== undefined) updateData.lng = data.lng
    if (data.placeId !== undefined) updateData.placeId = data.placeId

    // Si placeId donné + pas de lat/lng/title -> on copie depuis Place
    if (data.placeId) {
      const place = await tx.place.findUnique({
        where: { id: data.placeId },
        select: { name: true, lat: true, lng: true }
      })
      if (!place) throw new Error('Invalid placeId')

      if (updateData.title === undefined) updateData.title = place.name
      if (updateData.lat === undefined) updateData.lat = place.lat
      if (updateData.lng === undefined) updateData.lng = place.lng
    }

    return tx.tripStop.update({
      where: { id: stopId },
      data: updateData
    })
  })
}

// -----------------------------
// Déplacer un stop à un index cible (reorder)
// tx est optionnel pour réutiliser dans updateStop
// -----------------------------
async function moveStop(stopId, targetIndex, txParam) {
  const run = async (tx) => {
    if (!Number.isInteger(targetIndex) || targetIndex < 1) {
      throw new Error('targetIndex must be an integer >= 1')
    }

    const stop = await tx.tripStop.findUnique({
      where: { id: stopId },
      select: { id: true, tripId: true, orderIndex: true }
    })
    if (!stop) throw new Error('Stop not found')

    const { tripId, orderIndex: from } = stop
    const to = targetIndex
    if (from === to) return stop

    // On borne "to" si trop grand => max+1
    const max = await tx.tripStop.findFirst({
      where: { tripId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true }
    })
    const maxIndex = max ? max.orderIndex : 0
    const boundedTo = Math.min(to, maxIndex + 1)

    // On libère l'unique en mettant temporairement le stop à -1
    await tx.tripStop.update({
      where: { id: stopId },
      data: { orderIndex: -1 }
    })

    if (boundedTo < from) {
      // Move up: on décale [boundedTo .. from-1] vers +1
      await tx.tripStop.updateMany({
        where: { tripId, orderIndex: { gte: boundedTo, lt: from } },
        data: { orderIndex: { increment: 1 } }
      })
    } else {
      // Move down: on décale [from+1 .. boundedTo] vers -1
      await tx.tripStop.updateMany({
        where: { tripId, orderIndex: { gt: from, lte: boundedTo } },
        data: { orderIndex: { decrement: 1 } }
      })
    }

    // On place le stop à sa nouvelle position
    return tx.tripStop.update({
      where: { id: stopId },
      data: { orderIndex: boundedTo }
    })
  }

  return txParam ? run(txParam) : prisma.$transaction(run)
}

// Monter / descendre (helper)
async function moveUp(stopId) {
  const stop = await prisma.tripStop.findUnique({
    where: { id: stopId },
    select: { orderIndex: true }
  })
  if (!stop) throw new Error('Stop not found')
  return moveStop(stopId, stop.orderIndex - 1)
}

async function moveDown(stopId) {
  const stop = await prisma.tripStop.findUnique({
    where: { id: stopId },
    select: { orderIndex: true }
  })
  if (!stop) throw new Error('Stop not found')
  return moveStop(stopId, stop.orderIndex + 1)
}

// -----------------------------
// Remove stop (optionnel: refermer les trous)
// Ici je te propose de refermer: tout ce qui est > removedIndex décale -1
// -----------------------------
async function removeStop(stopId) {
  if (!stopId) throw new Error('Stop id is required')

  return prisma.$transaction(async (tx) => {
    const stop = await tx.tripStop.findUnique({
      where: { id: stopId },
      select: { tripId: true, orderIndex: true }
    })
    if (!stop) throw new Error('Stop not found')

    await tx.tripStop.delete({ where: { id: stopId } })

    await tx.tripStop.updateMany({
      where: { tripId: stop.tripId, orderIndex: { gt: stop.orderIndex } },
      data: { orderIndex: { decrement: 1 } }
    })

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