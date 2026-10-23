// electron/main.js
// Application de bureau Travel Map (Windows) :
// 1. prépare le dossier de données de l'utilisateur (%AppData%\Travel Map)
//    - base SQLite : copiée depuis la base modèle au premier lancement
//    - dossier uploads/ (photos, couvertures, vlogs)
// 2. applique les migrations Prisma manquantes (mises à jour de l'app)
// 3. démarre le serveur Express sur 127.0.0.1, port libre
// 4. ouvre une fenêtre sur ce serveur ; les liens externes s'ouvrent dans le navigateur
// 5. zoom réglable (Ctrl + molette, Ctrl +/-, Ctrl 0) et mémorisé dans window.json

const { app, BrowserWindow, dialog, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const { runMigrations } = require('./migrate')

// une seule instance : un 2e lancement remet la fenêtre existante au premier plan
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

let mainWindow = null
let server = null

// =============================
// ZOOM (mémorisé dans %AppData%\Travel Map\window.json)
// =============================
const DEFAULT_ZOOM = 0.67 // 67 % : à ajuster selon ton écran (0.8 = 80 %, 1 = 100 %)
const ZOOM_STEP = 0.1
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2

function windowStateFile() {
  return path.join(app.getPath('userData'), 'window.json')
}

function loadZoom() {
  try {
    const zoom = JSON.parse(fs.readFileSync(windowStateFile(), 'utf8')).zoom
    return Number.isFinite(zoom) ? clampZoom(zoom) : DEFAULT_ZOOM
  } catch {
    return DEFAULT_ZOOM // fichier absent ou illisible
  }
}

function saveZoom(zoom) {
  try {
    fs.writeFileSync(windowStateFile(), JSON.stringify({ zoom }, null, 2))
  } catch (err) {
    console.error('Impossible d\'enregistrer le zoom :', err.message)
  }
}

function clampZoom(zoom) {
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) * 100) / 100
}

function setZoom(webContents, zoom) {
  const value = clampZoom(zoom)
  webContents.setZoomFactor(value)
  saveZoom(value)
}

function setupZoom(webContents) {
  // dernier zoom enregistré, réappliqué à chaque page chargée (carte, pays, roadtrips...)
  webContents.on('did-finish-load', () => webContents.setZoomFactor(loadZoom()))

  // Ctrl + molette
  webContents.on('zoom-changed', (event, direction) => {
    setZoom(webContents, webContents.getZoomFactor() + (direction === 'in' ? ZOOM_STEP : -ZOOM_STEP))
  })

  // Ctrl + / Ctrl - / Ctrl 0, clavier AZERTY compris (le 0 du haut donne "à")
  webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return
    const { key, code } = input

    if (key === '+' || key === '=' || code === 'NumpadAdd') {
      setZoom(webContents, webContents.getZoomFactor() + ZOOM_STEP)
    } else if (key === '-' || code === 'NumpadSubtract') {
      setZoom(webContents, webContents.getZoomFactor() - ZOOM_STEP)
    } else if (key === '0' || key === 'à' || code === 'Numpad0' || code === 'Digit0') {
      setZoom(webContents, DEFAULT_ZOOM)
    } else {
      return
    }
    event.preventDefault()
  })
}

// =============================
// CHEMINS
// =============================
// app empaquetée : ressources à côté de l'exécutable (extraResources)
// développement   : fichiers du projet
function resourcePath(...parts) {
  return app.isPackaged
    ? path.join(process.resourcesPath, ...parts)
    : path.join(__dirname, '..', ...parts)
}

function getPaths() {
  const dataDir = app.getPath('userData') // %AppData%\Travel Map
  return {
    dataDir,
    dbFile: path.join(dataDir, 'travel-map.db'),
    uploadsDir: path.join(dataDir, 'uploads'),
    templateDb: app.isPackaged ? resourcePath('template.db') : resourcePath('build', 'template.db'),
    migrationsDir: app.isPackaged ? resourcePath('migrations') : resourcePath('prisma', 'migrations'),
  }
}

// =============================
// DONNÉES DE L'UTILISATEUR
// =============================
function prepareData(paths) {
  fs.mkdirSync(paths.dataDir, { recursive: true })
  for (const sub of ['places', 'countries', 'vlogs']) {
    fs.mkdirSync(path.join(paths.uploadsDir, sub), { recursive: true })
  }

  // premier lancement : base modèle (déjà migrée + pays du seed)
  if (!fs.existsSync(paths.dbFile)) {
    if (!fs.existsSync(paths.templateDb)) {
      throw new Error(`Base modèle introuvable : ${paths.templateDb}\nLance "npm run db:template" avant de construire l'app.`)
    }
    fs.copyFileSync(paths.templateDb, paths.dbFile)
  }

  // mises à jour : migrations ajoutées depuis la création de la base
  const Database = require('better-sqlite3')
  const db = new Database(paths.dbFile)
  try {
    const applied = runMigrations(db, paths.migrationsDir)
    if (applied.length) console.log('Migrations appliquées :', applied.join(', '))
  } finally {
    db.close()
  }
}

// =============================
// FENÊTRE
// =============================
function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Travel Map',
    backgroundColor: '#1a1a1a', // pas de flash blanc au démarrage
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      zoomFactor: loadZoom(),
    },
  })

  setupZoom(mainWindow.webContents)

  mainWindow.once('ready-to-show', () => mainWindow.show())

  const isLocal = (target) => target.startsWith(url)

  // liens target="_blank" (vidéos, sources...) -> navigateur par défaut
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (!isLocal(target) && /^https?:/i.test(target)) shell.openExternal(target)
    return { action: 'deny' }
  })

  // navigation vers un site externe dans la fenêtre -> navigateur par défaut
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (isLocal(target)) return
    event.preventDefault()
    if (/^https?:/i.test(target)) shell.openExternal(target)
  })

  mainWindow.on('closed', () => { mainWindow = null })
  mainWindow.loadURL(url)
}

// =============================
// DÉMARRAGE
// =============================
async function start() {
  const paths = getPaths()
  prepareData(paths)

  // à définir AVANT de charger le serveur (src/prisma.js lit DATABASE_URL au chargement)
  process.env.DATABASE_URL = `file:${paths.dbFile.replace(/\\/g, '/')}`
  process.env.UPLOADS_DIR = paths.uploadsDir

  const { startServer } = require('../src/server')
  const started = await startServer({ port: 0, host: '127.0.0.1' }) // port 0 = port libre
  server = started.server

  // window.json créé dès le premier lancement (modifiable à la main)
  if (!fs.existsSync(windowStateFile())) saveZoom(DEFAULT_ZOOM)

  createWindow(`http://127.0.0.1:${started.port}`)
}

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.whenReady()
  .then(start)
  .catch((err) => {
    console.error(err)
    dialog.showErrorBox('Travel Map ne peut pas démarrer', String(err?.stack || err))
    app.quit()
  })

app.on('window-all-closed', () => app.quit())

app.on('before-quit', () => {
  server?.close()
})