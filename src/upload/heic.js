// src/upload/heic.js
// Conversion HEIC / HEIF (photos d'iPhone) -> JPEG.
//
// Chromium (donc Electron et Chrome) n'affiche pas le HEIC : on ne garde jamais
// le fichier d'origine. multer.js accepte le HEIC, puis les services appellent
// convertIfHeic / convertAllHeic AVANT d'écrire en base.
//
// heic-convert est du JavaScript pur (décodeur libheif compilé en WebAssembly) :
// aucun module natif, rien à recompiler pour Electron.
// Nécessite : npm install heic-convert

const fs = require('fs/promises')
const path = require('path')

const HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']
const HEIC_EXTENSIONS = ['.heic', '.heif']
const JPEG_QUALITY = 0.9 // 0..1

// marques ISO-BMFF des fichiers HEIC / HEIF (octets 8 à 11, après "ftyp")
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']

function httpError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

function extensionOf(name) {
  return path.extname(String(name || '')).toLowerCase()
}

// Le fichier est-il annoncé comme HEIC ?
// Sous Windows, le navigateur envoie souvent un type vide ou
// "application/octet-stream" pour un .heic : on regarde aussi l'extension.
function isHeicUpload(file) {
  return HEIC_TYPES.includes(file?.mimetype) || HEIC_EXTENSIONS.includes(extensionOf(file?.originalname))
}

// Vérifie le contenu réel (les 12 premiers octets) : "....ftypheic", "....ftypmif1"...
function hasHeicSignature(buffer) {
  if (!buffer || buffer.length < 12) return false
  if (buffer.toString('ascii', 4, 8) !== 'ftyp') return false
  return HEIC_BRANDS.includes(buffer.toString('ascii', 8, 12))
}

// chargé seulement au premier HEIC (le décodeur est lourd)
let converter = null
function getConverter() {
  if (!converter) converter = require('heic-convert')
  return converter
}

// Convertit un fichier reçu par multer s'il est en HEIC.
// - pas un HEIC : le fichier est renvoyé tel quel
// - HEIC : écrit <même nom>.jpg à côté, supprime l'original, et met à jour
//   file.path / filename / mimetype / size / originalname
// - échec : le fichier d'origine est laissé en place (file.path inchangé),
//   pour que le service le supprime avec les autres ; erreur HTTP 415 ou 422
async function convertIfHeic(file) {
  if (!file?.path || !isHeicUpload(file)) return file

  const input = await fs.readFile(file.path)
  if (!hasHeicSignature(input)) {
    throw httpError(415, `"${file.originalname}" n'est pas une image HEIC valide.`)
  }

  const dir = path.dirname(file.path)
  const filename = `${path.basename(file.path, path.extname(file.path))}.jpg`
  const output = path.join(dir, filename)

  let jpeg
  try {
    // seule l'image principale est gardée (photo Live, rafale...)
    jpeg = Buffer.from(await getConverter()({ buffer: input, format: 'JPEG', quality: JPEG_QUALITY }))
  } catch (err) {
    console.error(`Conversion HEIC impossible (${file.originalname}) :`, err)
    throw httpError(422, `Impossible de convertir la photo HEIC "${file.originalname}".`)
  }

  try {
    await fs.writeFile(output, jpeg)
  } catch (err) {
    await fs.rm(output, { force: true }).catch(() => {})
    throw err
  }

  await fs.rm(file.path, { force: true }).catch(() => {})

  file.path = output
  file.filename = filename
  file.mimetype = 'image/jpeg'
  file.size = jpeg.length
  file.originalname = `${path.basename(file.originalname, path.extname(file.originalname))}.jpg`
  file.convertedFrom = 'heic'
  return file
}

// Convertit une liste, une photo à la fois (un HEIC de 12 Mpx décodé
// prend environ 50 Mo de mémoire). S'arrête à la première erreur : les
// fichiers déjà convertis ont leur nouveau file.path, les autres l'ancien,
// donc le nettoyage du service retrouve tout.
async function convertAllHeic(files = []) {
  for (const file of files) await convertIfHeic(file)
  return files
}

module.exports = {
  HEIC_TYPES,
  HEIC_EXTENSIONS,
  isHeicUpload,
  convertIfHeic,
  convertAllHeic,
}