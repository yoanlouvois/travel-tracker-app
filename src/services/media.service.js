// src/services/media.service.js
// Médias (photos / vidéos) d'un lieu : lignes Media en base + fichiers sur le disque.

const fs = require('fs')
const path = require('path')
const prisma = require('../prisma')
const { LIMITS, isVideo } = require('../upload/multer')
const {
  toPublicPath,
  removePublicFile,
  removeDiskFiles,
} = require('../upload/files')

const MEDIA_TYPES = ['PHOTO', 'VIDEO']
const MB = 1024 * 1024

// =================================================
// HELPERS
// =================================================
function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

// Prisma lève P2025 quand update/delete ne trouve pas l'enregistrement
function mapNotFound(err) {
  if (err?.code === 'P2025') return httpError(404, 'Media not found')
  return err
}

function assertMediaType(mediaType) {
  if (!MEDIA_TYPES.includes(mediaType)) {
    throw httpError(400, `Invalid mediaType "${mediaType}" (expected PHOTO or VIDEO)`)
  }
}

function toDateOrNull(value) {
  if (value == null || value === '') return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw httpError(400, `Invalid date: ${value}`)
  return d
}

async function assertPlaceExists(placeId) {
  if (!placeId) throw httpError(400, 'placeId is required')
  const place = await prisma.place.findUnique({ where: { id: placeId }, select: { id: true } })
  if (!place) throw httpError(404, 'Place not found')
}

async function nextSortOrder(placeId) {
  const last = await prisma.media.findFirst({
    where: { placeId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  return last ? last.sortOrder + 1 : 0
}

// =================================================
// LIST / GET
// =================================================
// Options: { placeId, mediaType }
async function list({ placeId, mediaType } = {}) {
  const where = {}
  if (placeId) where.placeId = placeId
  if (mediaType) {
    assertMediaType(mediaType)
    where.mediaType = mediaType
  }

  return prisma.media.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { takenAt: 'desc' }],
    include: { place: true },
  })
}

async function getById(id) {
  if (!id) throw httpError(400, 'Media id is required')

  const media = await prisma.media.findUnique({
    where: { id },
    include: { place: true },
  })

  if (!media) throw httpError(404, 'Media not found')
  return media
}

// =================================================
// CREATE (JSON : fichier déjà présent, ex : chemin importé)
// =================================================
async function create(data = {}) {
  const { placeId, filePath, caption, takenAt, sortOrder, mediaType } = data

  if (!placeId || !filePath) throw httpError(400, 'placeId and filePath are required')
  await assertPlaceExists(placeId)
  if (mediaType !== undefined) assertMediaType(mediaType)

  return prisma.media.create({
    data: {
      placeId,
      filePath,
      caption: caption ?? null,
      takenAt: toDateOrNull(takenAt),
      sortOrder: Number.isInteger(sortOrder) ? sortOrder : await nextSortOrder(placeId),
      mediaType: mediaType ?? 'PHOTO',
    },
    include: { place: true },
  })
}

// =================================================
// CREATE (fichiers envoyés, déjà écrits par multer)
// =================================================
// files : req.files de multer ([{ path, mimetype, size, originalname }])
// Renvoie les médias créés, dans l'ordre d'envoi.
// En cas d'erreur, les fichiers reçus sont supprimés du disque.
async function createFromUploads(placeId, files = []) {
  const diskPaths = files.map((f) => f.path)

  try {
    if (!files.length) throw httpError(400, 'Aucun fichier reçu (champ "files").')
    await assertPlaceExists(placeId)

    // les photos ont une limite plus basse que les vidéos
    const tooBig = files.find((f) => !isVideo(f.mimetype) && f.size > LIMITS.photo)
    if (tooBig) {
      throw httpError(413, `Photo trop volumineuse : "${tooBig.originalname}" (${LIMITS.photo / MB} Mo maximum).`)
    }

    const start = await nextSortOrder(placeId)

    return await prisma.$transaction(
      files.map((file, i) => prisma.media.create({
        data: {
          placeId,
          filePath: toPublicPath(file.path),
          mediaType: isVideo(file.mimetype) ? 'VIDEO' : 'PHOTO',
          caption: null,
          takenAt: null,
          sortOrder: start + i,
        },
      }))
    )
  } catch (err) {
    await removeDiskFiles(diskPaths)
    // dossier du lieu créé pour rien (ex : lieu inexistant) -> supprimé s'il est vide
    if (diskPaths[0]) await fs.promises.rmdir(path.dirname(diskPaths[0])).catch(() => {})
    throw err
  }
}

// =================================================
// UPDATE
// =================================================
async function update(id, data = {}) {
  if (!id) throw httpError(400, 'Media id is required')

  const updateData = {}
  if (data.filePath !== undefined) updateData.filePath = data.filePath
  if (data.caption !== undefined) updateData.caption = data.caption || null
  if (data.takenAt !== undefined) updateData.takenAt = toDateOrNull(data.takenAt)
  if (data.sortOrder !== undefined) {
    if (!Number.isInteger(data.sortOrder)) throw httpError(400, 'sortOrder must be an integer')
    updateData.sortOrder = data.sortOrder
  }
  if (data.mediaType !== undefined) {
    assertMediaType(data.mediaType)
    updateData.mediaType = data.mediaType
  }

  try {
    return await prisma.media.update({
      where: { id },
      data: updateData,
      include: { place: true },
    })
  } catch (err) {
    throw mapNotFound(err)
  }
}

// =================================================
// DELETE (ligne en base + fichier sur le disque)
// =================================================
async function remove(id) {
  if (!id) throw httpError(400, 'Media id is required')

  let deleted
  try {
    deleted = await prisma.media.delete({ where: { id } })
  } catch (err) {
    throw mapNotFound(err)
  }

  // fichier supprimé seulement une fois la ligne supprimée
  await removePublicFile(deleted.filePath)
  return deleted
}

module.exports = {
  assertPlaceExists,
  list,
  getById,
  create,
  createFromUploads,
  update,
  remove,
}
