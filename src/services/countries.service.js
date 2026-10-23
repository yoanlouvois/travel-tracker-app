// src/services/countries.service.js
const prisma = require('../prisma')
const {
  toPublicPath,
  removePublicFile,
  removeDiskFiles,
  removeDirIfEmpty,
} = require('../upload/files')

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
  if (err?.code === 'P2025') return httpError(404, 'Country not found')
  return err
}

async function assertCountryExists(id) {
  if (!id) throw httpError(400, 'Country id is required')
  const country = await prisma.country.findUnique({ where: { id }, select: { id: true } })
  if (!country) throw httpError(404, 'Country not found')
}

// =================================================
// LIST / GET
// =================================================
async function list() {
  return prisma.country.findMany({
    orderBy: { name: 'asc' },
  })
}

async function getById(id) {
  if (!id) throw httpError(400, 'Country id is required')

  const country = await prisma.country.findUnique({ where: { id } })
  if (!country) throw httpError(404, 'Country not found')

  return country
}

// =================================================
// CREATE / UPDATE / DELETE
// =================================================
async function create(data = {}) {
  if (!data.name || !data.iso2) throw httpError(400, 'name and iso2 are required')

  return prisma.country.create({
    data: {
      name: data.name,
      iso2: data.iso2.toUpperCase(),
      uiCoverImagePath: data.uiCoverImagePath ?? null,
      visited: data.visited ?? false,
      toVisit: data.toVisit ?? false,
    },
  })
}

async function update(id, data = {}) {
  if (!id) throw httpError(400, 'Country id is required')

  try {
    return await prisma.country.update({
      where: { id },
      data: {
        name: data.name,
        iso2: data.iso2 ? data.iso2.toUpperCase() : undefined,
        uiCoverImagePath: data.uiCoverImagePath,
        visited: data.visited,
        toVisit: data.toVisit,
      },
    })
  } catch (err) {
    throw mapNotFound(err)
  }
}

async function remove(id) {
  if (!id) throw httpError(400, 'Country id is required')

  let deleted
  try {
    deleted = await prisma.country.delete({ where: { id } })
  } catch (err) {
    throw mapNotFound(err)
  }

  await removePublicFile(deleted.uiCoverImagePath)
  return deleted
}

// =================================================
// COUVERTURE
// =================================================
// file : req.file de multer ({ path }) - l'image est déjà écrite sur le disque.
// Remplace la couverture et supprime l'ancienne image.
async function setCover(id, file) {
  if (!file) throw httpError(400, 'Aucune image reçue (champ "cover").')

  try {
    const current = await getById(id)
    const updated = await prisma.country.update({
      where: { id },
      data: { uiCoverImagePath: toPublicPath(file.path) },
    })

    // ancienne image supprimée seulement une fois la nouvelle enregistrée
    if (current.uiCoverImagePath && current.uiCoverImagePath !== updated.uiCoverImagePath) {
      await removePublicFile(current.uiCoverImagePath)
    }
    return updated
  } catch (err) {
    await removeDiskFiles([file.path]) // nouvelle image inutile
    throw mapNotFound(err)
  }
}

// Retire la couverture (et supprime l'image)
async function removeCover(id) {
  const current = await getById(id)
  if (!current.uiCoverImagePath) return current

  const updated = await prisma.country.update({
    where: { id },
    data: { uiCoverImagePath: null },
  })

  await removePublicFile(current.uiCoverImagePath)
  await removeDirIfEmpty(`/uploads/countries/${id}`)
  return updated
}

module.exports = {
  assertCountryExists,
  list,
  getById,
  create,
  update,
  remove,
  setCover,
  removeCover,
}