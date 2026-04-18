const prisma = require('../prisma')

// Récupérer tous les pays
async function list() {
  return prisma.country.findMany({
    orderBy: { name: 'asc' }
  })
}

// Récupérer un pays par ID
async function getById(id) {
  if (!id) {
    throw new Error('Country id is required')
  }

  const country = await prisma.country.findUnique({
    where: { id }
  })

  if (!country) {
    throw new Error('Country not found')
  }

  return country
}

// Créer un pays
async function create(data) {
  if (!data?.name || !data?.iso2) {
    throw new Error('name and iso2 are required')
  }

  return prisma.country.create({
    data: {
      name: data.name,
      iso2: data.iso2.toUpperCase(),
      uiCoverImagePath: data.uiCoverImagePath ?? null,
      visited: data.visited ?? false,
      toVisit: data.toVisit ?? false
    }
  })
}

// Mettre à jour un pays
async function update(id, data) {
  if (!id) {
    throw new Error('Country id is required')
  }

  return prisma.country.update({
    where: { id },
    data: {
      name: data.name,
      iso2: data.iso2 ? data.iso2.toUpperCase() : undefined,
      uiCoverImagePath: data.uiCoverImagePath,
      visited: data.visited,
      toVisit: data.toVisit
    }
  })
}

// Supprimer un pays
async function remove(id) {
  if (!id) {
    throw new Error('Country id is required')
  }

  return prisma.country.delete({
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