const countriesService = require('../services/countries.service')

// GET /api/countries
async function list(req, res, next) {
  try {
    const countries = await countriesService.list()
    res.json(countries)
  } catch (err) {
    next(err)
  }
}

// GET /api/countries/:id
async function getById(req, res, next) {
  try {
    const country = await countriesService.getById(req.params.id)
    res.json(country)
  } catch (err) {
    next(err)
  }
}

// POST /api/countries
async function create(req, res, next) {
  try {
    const created = await countriesService.create(req.body)
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
}

// PATCH /api/countries/:id
async function update(req, res, next) {
  try {
    const updated = await countriesService.update(req.params.id, req.body)
    res.json(updated)
  } catch (err) {
    next(err)
  }
}

// DELETE /api/countries/:id
async function remove(req, res, next) {
  try {
    await countriesService.remove(req.params.id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

// Middleware à placer AVANT l'upload : refuse tout de suite un pays inexistant
// (évite d'écrire le fichier pour rien)
async function ensureCountry(req, res, next) {
  try {
    await countriesService.assertCountryExists(req.params.id)
    next()
  } catch (err) {
    next(err)
  }
}

// POST /api/countries/:id/cover  (multipart/form-data, champ "cover", une image)
// À placer après le middleware uploadCountryCover (src/upload/multer.js)
async function uploadCover(req, res, next) {
  try {
    const updated = await countriesService.setCover(req.params.id, req.file)
    res.json(updated)
  } catch (err) {
    next(err)
  }
}

// DELETE /api/countries/:id/cover
async function removeCover(req, res, next) {
  try {
    const updated = await countriesService.removeCover(req.params.id)
    res.json(updated)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  ensureCountry,
  uploadCover,
  removeCover,
}