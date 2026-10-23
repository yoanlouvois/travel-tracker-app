// src/upload/multer.js
// Réception des fichiers envoyés en multipart/form-data.
//
//   uploadPlaceMedia   : champ "files" (plusieurs)  -> uploads/places/<placeId>/
//   uploadCountryCover : champ "cover" (un seul)    -> uploads/countries/<countryId>/
//
// Les fichiers reçoivent un nom unique (pas le nom d'origine) pour éviter
// les collisions et les caractères problématiques.
// Nécessite : npm install multer

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const multer = require('multer')
const { getUploadsDir } = require('./files')

// =============================
// TYPES ET LIMITES
// =============================
const IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

const VIDEO_TYPES = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
}

const MB = 1024 * 1024
const LIMITS = {
  photo: 20 * MB,   // vérifié après réception (multer n'a qu'une limite commune)
  video: 500 * MB,  // limite multer : aucun fichier ne peut dépasser ça
  filesPerUpload: 30,
}

function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

function isVideo(mimetype) {
  return Boolean(VIDEO_TYPES[mimetype])
}

// =============================
// STOCKAGE
// =============================
// subdir(req) -> sous-dossier, ex : "places/<id>"
function storageIn(subdir) {
  return multer.diskStorage({
    destination(req, file, cb) {
      const dir = path.join(req.app?.locals?.uploadsDir || getUploadsDir(), subdir(req))
      fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir))
    },
    filename(req, file, cb) {
      const ext = IMAGE_TYPES[file.mimetype] || VIDEO_TYPES[file.mimetype] || ''
      const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`
      cb(null, `${unique}${ext}`)
    },
  })
}

function filterTypes(allowed, label) {
  return (req, file, cb) => {
    if (allowed[file.mimetype]) return cb(null, true)
    cb(httpError(415, `Type de fichier non accepté : "${file.originalname}". ${label}`))
  }
}

// id de l'URL réduit à des caractères sûrs pour un nom de dossier
const safeId = (id) => String(id || '').replace(/[^a-zA-Z0-9_-]/g, '')

// =============================
// ERREURS MULTER -> HTTP
// =============================
function toHttpError(err, maxBytes) {
  if (!(err instanceof multer.MulterError)) return err
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return httpError(413, `Fichier trop volumineux (${maxBytes / MB} Mo maximum).`)
    case 'LIMIT_FILE_COUNT':
      return httpError(400, `Trop de fichiers d'un coup (${LIMITS.filesPerUpload} maximum).`)
    case 'LIMIT_UNEXPECTED_FILE':
      return httpError(400, `Champ de fichier inattendu : "${err.field}".`)
    default:
      return httpError(400, `Envoi de fichier invalide (${err.code}).`)
  }
}

// enveloppe un middleware multer pour convertir ses erreurs
function wrap(middleware, maxBytes) {
  return (req, res, next) => middleware(req, res, (err) => next(err ? toHttpError(err, maxBytes) : undefined))
}

// =============================
// MIDDLEWARES
// =============================
const uploadPlaceMedia = wrap(multer({
  storage: storageIn((req) => path.join('places', safeId(req.params.id))),
  fileFilter: filterTypes({ ...IMAGE_TYPES, ...VIDEO_TYPES }, 'Photos JPG, PNG, WebP ou vidéos MP4, WebM.'),
  limits: { fileSize: LIMITS.video, files: LIMITS.filesPerUpload },
}).array('files', LIMITS.filesPerUpload), LIMITS.video)

const uploadCountryCover = wrap(multer({
  storage: storageIn((req) => path.join('countries', safeId(req.params.id))),
  fileFilter: filterTypes(IMAGE_TYPES, 'Image JPG, PNG ou WebP.'),
  limits: { fileSize: LIMITS.photo, files: 1 },
}).single('cover'), LIMITS.photo)

module.exports = {
  LIMITS,
  isVideo,
  uploadPlaceMedia,
  uploadCountryCover,
}
