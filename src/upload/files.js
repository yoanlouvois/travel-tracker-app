// src/upload/files.js
// Fichiers envoyés (photos, vidéos, couvertures) : chemins et suppression.
//
// En base, les chemins sont publics : "/uploads/places/<placeId>/<fichier>".
// Sur le disque, ils sont dans le dossier d'uploads :
// - développement   : public/uploads
// - app installée   : %AppData%\Travel Map\uploads (UPLOADS_DIR, défini par electron/main.js)

const fs = require('fs')
const path = require('path')

const PUBLIC_PREFIX = '/uploads/'

// même règle que src/app.js
function getUploadsDir() {
  return path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'public', 'uploads'))
}

// chemin disque -> chemin public ("/uploads/...", toujours avec des "/")
function toPublicPath(diskPath) {
  const relative = path.relative(getUploadsDir(), diskPath)
  return PUBLIC_PREFIX + relative.split(path.sep).join('/')
}

// chemin public -> chemin disque ; null si le chemin sort du dossier d'uploads
// (protection contre "/uploads/../../fichier")
function toDiskPath(publicPath) {
  if (typeof publicPath !== 'string' || !publicPath.startsWith(PUBLIC_PREFIX)) return null
  const root = getUploadsDir()
  const diskPath = path.resolve(root, publicPath.slice(PUBLIC_PREFIX.length))
  return diskPath.startsWith(root + path.sep) ? diskPath : null
}

// supprime un fichier par son chemin public ; ignore les fichiers absents
// et les chemins hors du dossier d'uploads (liens externes, chemins importés...)
async function removePublicFile(publicPath) {
  const diskPath = toDiskPath(publicPath)
  if (!diskPath) return false
  try {
    await fs.promises.unlink(diskPath)
    return true
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Suppression impossible :', diskPath, err.message)
    return false
  }
}

async function removePublicFiles(publicPaths) {
  await Promise.all([...new Set(publicPaths)].map(removePublicFile))
}

// supprime des fichiers tout juste reçus (chemins disque), ex : après une erreur
async function removeDiskFiles(diskPaths) {
  await Promise.all(diskPaths.map((p) => fs.promises.unlink(p).catch(() => {})))
}

// supprime un dossier d'uploads s'il est vide (ex : uploads/places/<placeId>)
async function removeDirIfEmpty(publicDir) {
  const diskPath = toDiskPath(publicDir.endsWith('/') ? publicDir : `${publicDir}/`)
  if (!diskPath) return
  try {
    await fs.promises.rmdir(diskPath) // échoue si le dossier n'est pas vide : c'est voulu
  } catch {
    // dossier absent ou non vide
  }
}

module.exports = {
  PUBLIC_PREFIX,
  getUploadsDir,
  toPublicPath,
  toDiskPath,
  removePublicFile,
  removePublicFiles,
  removeDiskFiles,
  removeDirIfEmpty,
}
