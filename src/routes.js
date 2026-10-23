const express = require('express')

const countriesController = require('./controllers/countries.controller')
const vlogsController = require('./controllers/vlogs.controller')
const placesController = require('./controllers/places.controller')
const tripsController = require('./controllers/trips.controller')
const mediaController = require('./controllers/media.controller')
const backupController = require('./controllers/backup.controller')
const geocodeController = require('./controllers/geocode.controller')
const { uploadPlaceMedia, uploadCountryCover } = require('./upload/multer')

const router = express.Router()

// Countries
router.get('/countries', countriesController.list)
router.get('/countries/:id', countriesController.getById)
router.post('/countries', countriesController.create)
router.patch('/countries/:id', countriesController.update)
router.delete('/countries/:id', countriesController.remove)

// Vlogs
router.get('/vlogs', vlogsController.list)
router.get('/vlogs/:id', vlogsController.getById)
router.post('/vlogs', vlogsController.create)
router.patch('/vlogs/:id', vlogsController.update)
router.delete('/vlogs/:id', vlogsController.remove)

// liens Vlog / Country
router.post('/vlogs/:id/countries/:countryId', vlogsController.linkToCountry)
router.delete('/vlogs/:id/countries/:countryId', vlogsController.unlinkFromCountry)
router.put('/vlogs/:id/countries', vlogsController.setCountries)

// Places
router.get('/places', placesController.list)
router.get('/places/:id', placesController.getById)
router.post('/places', placesController.create)
router.patch('/places/:id', placesController.update)
router.delete('/places/:id', placesController.remove)

// Trips
router.get('/trips', tripsController.list)
router.get('/trips/:id', tripsController.getById)
router.post('/trips', tripsController.create)
router.patch('/trips/:id', tripsController.update)
router.delete('/trips/:id', tripsController.remove)

// Stops
router.post('/trips/:id/stops', tripsController.addStop)
router.patch('/trips/stops/:stopId', tripsController.updateStop)
router.delete('/trips/stops/:stopId', tripsController.removeStop)

// Media
router.get('/media', mediaController.list)
router.get('/media/:id', mediaController.getById)
router.post('/media', mediaController.create)
router.patch('/media/:id', mediaController.update)
router.delete('/media/:id', mediaController.remove)

// Backup 
router.get('/backup/export', backupController.exportJson)
router.post('/backup/import', backupController.importJson)

// Géocodage
router.get('/geocode/search', geocodeController.search)

// Photos / vidéos d'un lieu
router.post('/places/:id/media', mediaController.ensurePlace, uploadPlaceMedia, mediaController.uploadForPlace)

// Couverture d'un pays
router.post('/countries/:id/cover', countriesController.ensureCountry, uploadCountryCover, countriesController.uploadCover)
router.delete('/countries/:id/cover', countriesController.removeCover)

module.exports = router