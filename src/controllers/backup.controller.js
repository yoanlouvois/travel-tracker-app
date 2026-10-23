// src/controllers/backup.controller.js
const backupService = require('../services/backup.service')

// GET /api/backup/export
// Télécharge l'état actuel de la base en JSON (travel-map-AAAA-MM-JJ.json)
async function exportJson(req, res, next) {
  try {
    const data = await backupService.exportAll()
    const date = new Date().toISOString().slice(0, 10)

    res.setHeader('Content-Disposition', `attachment; filename="travel-map-${date}.json"`)
    res.type('application/json').send(JSON.stringify(data, null, 2))
  } catch (err) {
    next(err)
  }
}

// POST /api/backup/import
// Corps : le contenu du fichier JSON exporté
// Réponse : rapport { countries: { updated, unchanged }, places: { added, skipped }, ... }
async function importJson(req, res, next) {
  try {
    const report = await backupService.importAll(req.body)
    res.json(report)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  exportJson,
  importJson,
}