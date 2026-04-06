const mediaService = require('../services/media.service')

// GET /api/media
async function list(req, res, next) {
  try {
    const media = await mediaService.list({
      placeId: req.query.placeId,
      mediaType: req.query.mediaType
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

// POST /api/media
async function create(req, res, next) {
  try {
    const created = await mediaService.create(req.body)
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
}

// PATCH /api/media/:id
async function update(req, res, next) {
  try {
    const updated = await mediaService.update(req.params.id, req.body)
    res.json(updated)
  } catch (err) {
    next(err)
  }
}

// DELETE /api/media/:id
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
  update,
  remove
}