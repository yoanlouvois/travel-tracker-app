const tripsService = require('../services/trips.service')

// ============================
// TRIPS
// ============================

// GET /api/trips
async function list(req, res, next) {
  try {
    const trips = await tripsService.list()
    res.json(trips)
  } catch (err) {
    next(err)
  }
}

// GET /api/trips/:id
async function getById(req, res, next) {
  try {
    const trip = await tripsService.getById(req.params.id)
    res.json(trip)
  } catch (err) {
    next(err)
  }
}

// POST /api/trips
async function create(req, res, next) {
  try {
    const created = await tripsService.create(req.body)
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
}

// PATCH /api/trips/:id
async function update(req, res, next) {
  try {
    const updated = await tripsService.update(req.params.id, req.body)
    res.json(updated)
  } catch (err) {
    next(err)
  }
}

// DELETE /api/trips/:id
async function remove(req, res, next) {
  try {
    await tripsService.remove(req.params.id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

// ============================
// TRIP STOPS
// ============================

// POST /api/trips/:id/stops
async function addStop(req, res, next) {
  try {
    const stop = await tripsService.addStop(req.params.id, req.body)
    res.status(201).json(stop)
  } catch (err) {
    next(err)
  }
}

// PATCH /api/trips/stops/:stopId
async function updateStop(req, res, next) {
  try {
    const stop = await tripsService.updateStop(req.params.stopId, req.body)
    res.json(stop)
  } catch (err) {
    next(err)
  }
}

// DELETE /api/trips/stops/:stopId
async function removeStop(req, res, next) {
  try {
    await tripsService.removeStop(req.params.stopId)
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
  remove,
  addStop,
  updateStop,
  removeStop
}