const prisma = require('../prisma')

// -------- LIST --------
// Option: { countryId, type }
async function list({ countryId, type, visited } = {}) {
  const where = {}

  if (countryId) {
    where.countryId = countryId
  }

  if (type) {
    where.type = type
  }

  if (visited !== undefined) {
    where.visited = visited
  }

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
  if (!id) throw new Error('Place id is required')

  const place = await prisma.place.findUnique({
    where: { id },
    include: {
      country: true,
      media: true,
      tripStops: true
    }
  })

  if (!place) throw new Error('Place not found')

  return place
}

// -------- CREATE --------
async function create(data) {
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
    throw new Error('name, countryId, lat, lng and type are required')
  }

  // Vérifier que le pays existe
  const countryExists = await prisma.country.findUnique({
    where: { id: countryId }
  })

  if (!countryExists) {
    throw new Error('Invalid countryId')
  }

  return prisma.place.create({
    data: {
      name,
      countryId,
      lat,
      lng,
      type,
      description,
      visited: visited ?? false,
      visitedAt: visitedAt ? new Date(visitedAt) : null,
      source: source ?? 'MANUAL',
      nominatimPlaceId,
      nominatimName
    },
    include: {
      country: true
    }
  })
}

// -------- UPDATE --------
async function update(id, data) {
  if (!id) throw new Error('Place id is required')

  const updateData = {}

  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.type !== undefined) updateData.type = data.type
  if (data.lat !== undefined) updateData.lat = data.lat
  if (data.lng !== undefined) updateData.lng = data.lng
  if (data.visited !== undefined) updateData.visited = data.visited
  if (data.visitedAt !== undefined)
    updateData.visitedAt = data.visitedAt ? new Date(data.visitedAt) : null

  return prisma.place.update({
    where: { id },
    data: updateData,
    include: {
      country: true,
      media: true
    }
  })
}

// -------- DELETE --------
async function remove(id) {
  if (!id) throw new Error('Place id is required')

  return prisma.place.delete({
    where: { id }
  })
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove
}