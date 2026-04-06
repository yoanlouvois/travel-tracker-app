const prisma = require('../prisma')

// -------- LIST --------
// Option: { placeId, mediaType }
async function list({ placeId, mediaType } = {}) {
  const where = {}

  if (placeId) {
    where.placeId = placeId
  }

  if (mediaType) {
    where.mediaType = mediaType
  }

  return prisma.media.findMany({
    where,
    orderBy: [
      { sortOrder: 'asc' },
      { takenAt: 'desc' }
    ],
    include: {
      place: true
    }
  })
}

// -------- GET BY ID --------
async function getById(id) {
  if (!id) throw new Error('Media id is required')

  const media = await prisma.media.findUnique({
    where: { id },
    include: {
      place: true
    }
  })

  if (!media) throw new Error('Media not found')

  return media
}

// -------- CREATE --------
async function create(data) {
  const {
    placeId,
    filePath,
    caption,
    takenAt,
    sortOrder,
    mediaType
  } = data

  if (!placeId || !filePath) {
    throw new Error('placeId and filePath are required')
  }

  const placeExists = await prisma.place.findUnique({
    where: { id: placeId }
  })

  if (!placeExists) {
    throw new Error('Invalid placeId')
  }

  return prisma.media.create({
    data: {
      placeId,
      filePath,
      caption: caption ?? null,
      takenAt: takenAt ? new Date(takenAt) : null,
      sortOrder: sortOrder ?? 0,
      mediaType: mediaType ?? 'PHOTO'
    },
    include: {
      place: true
    }
  })
}

// -------- UPDATE --------
async function update(id, data) {
  if (!id) throw new Error('Media id is required')

  const updateData = {}

  if (data.filePath !== undefined) updateData.filePath = data.filePath
  if (data.caption !== undefined) updateData.caption = data.caption
  if (data.takenAt !== undefined) {
    updateData.takenAt = data.takenAt ? new Date(data.takenAt) : null
  }
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
  if (data.mediaType !== undefined) updateData.mediaType = data.mediaType

  return prisma.media.update({
    where: { id },
    data: updateData,
    include: {
      place: true
    }
  })
}

// -------- DELETE --------
async function remove(id) {
  if (!id) throw new Error('Media id is required')

  return prisma.media.delete({
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