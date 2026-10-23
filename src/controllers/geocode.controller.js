// src/controllers/geocode.controller.js
const geocodeService = require('../services/geocode.service')

// GET /api/geocode/search?q=Kyoto&limit=5&country=JP
// Réponse : liste de résultats (voir geocode.service.search)
async function search(req, res, next) {
  try {
    const { q, limit, country } = req.query
    const results = await geocodeService.search({ q, limit, country })
    res.json(results)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  search,
}