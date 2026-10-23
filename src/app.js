const express = require('express')
const path = require('path')
const routes = require('./routes')

const app = express()

// Photos, couvertures, vlogs :
// - app Electron : dans le dossier de l'utilisateur (UPLOADS_DIR, défini par electron/main.js)
// - développement : public/uploads
// Les chemins en base restent "/uploads/..." dans les deux cas.
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'public', 'uploads')
app.locals.uploadsDir = UPLOADS_DIR // pour multer (partie médias)

app.use('/uploads', express.static(UPLOADS_DIR))
app.use(express.static(path.join(__dirname, '..', 'public')))
app.use(express.json({ limit: '20mb' })) // 20 Mo : marge pour un gros export

app.use(
  '/leaflet',
  express.static(path.join(__dirname, '..', 'node_modules', 'leaflet', 'dist'))
)

app.use(
  '/bootstrap',
  express.static(path.join(__dirname, '..', 'node_modules', 'bootstrap', 'dist'))
)

app.use('/api', routes)

// route /api inconnue -> 404 en JSON
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Route introuvable : ${req.method} ${req.originalUrl}` })
})

// erreurs -> JSON { error } avec le bon statut
// (doit rester le dernier middleware, avec ses 4 paramètres)
app.use((err, req, res, next) => {
  let status = err.status || err.statusCode || 500
  let message = err.message || 'Erreur serveur'

  if (err.type === 'entity.too.large') {
    status = 413
    message = 'Fichier trop volumineux (20 Mo maximum).'
  } else if (err.type === 'entity.parse.failed') {
    status = 400
    message = "Le fichier n'est pas un JSON valide."
  }

  if (status >= 500) console.error(err)
  res.status(status).json({ error: status >= 500 ? 'Erreur serveur' : message })
})

module.exports = app
