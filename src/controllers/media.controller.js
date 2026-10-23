const mediaService = require('../services/media.service')

// GET /api/media?placeId=...&mediaType=PHOTO|VIDEO
async function list(req, res, next) {
  try {
    const media = await mediaService.list({
      placeId: req.query.placeId,
      mediaType: req.query.mediaType,
    })
    res.json(media)
  } catch (err) {
    next(err)
  }
}

// GET /api/media/:id
async function getById(req, res, next) {
  try {
    const media = await mediaService.getById(req.params.id)
    res.json(media)
  } catch (err) {
    next(err)
  }
}

// POST /api/media  (JSON : { placeId, filePath, ... } pour un fichier déjà présent)
async function create(req, res, next) {
  try {
    const created = await mediaService.create(req.body)
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
}

// Middleware à placer AVANT l'upload : refuse tout de suite un lieu inexistant
// (évite d'écrire de gros fichiers pour rien)
async function ensurePlace(req, res, next) {
  try {
    await mediaService.assertPlaceExists(req.params.id)
    next()
  } catch (err) {
    next(err)
  }
}

// POST /api/places/:id/media  (multipart/form-data, champ "files", plusieurs fichiers)
// À placer après le middleware uploadPlaceMedia (src/upload/multer.js)
async function uploadForPlace(req, res, next) {
  try {
    const created = await mediaService.createFromUploads(req.params.id, req.files)
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
}

// PATCH /api/media/:id  (légende, date, ordre...)
async function update(req, res, next) {
  try {
    const updated = await mediaService.update(req.params.id, req.body)
    res.json(updated)
  } catch (err) {
    next(err)
  }
}

// DELETE /api/media/:id  (supprime aussi le fichier)
async function remove(req, res, next) {
  try {
    await mediaService.remove(req.params.id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

module.exports = {
  list,
  getById,
  create,
  ensurePlace,
  uploadForPlace,
  update,
  remove,
}
