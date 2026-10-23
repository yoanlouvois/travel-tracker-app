// scripts/native.js
// Installe le binaire précompilé de better-sqlite3 pour le bon environnement,
// sans compilation (donc sans Visual Studio) :
//
//   node scripts/native.js electron   -> pour Electron (npm run app / npm run dist)
//   node scripts/native.js node       -> pour Node (npm start, scripts, CLI Prisma)
//
// Utilise prebuild-install (installé avec better-sqlite3), qui télécharge
// le binaire depuis les releases GitHub de better-sqlite3.
// Le fichier .node ne doit pas être utilisé pendant l'opération :
// arrête le serveur de dev et ferme l'app avant de lancer ce script.

const { execFileSync } = require('child_process')
const path = require('path')

const mode = process.argv[2]
if (!['electron', 'node'].includes(mode)) {
  console.error('Usage : node scripts/native.js electron|node')
  process.exit(1)
}

const moduleDir = path.dirname(require.resolve('better-sqlite3/package.json'))
const prebuildBin = require.resolve('prebuild-install/bin.js', { paths: [moduleDir] })

const target = mode === 'electron'
  ? require('electron/package.json').version
  : process.versions.node

const args = [
  prebuildBin,
  '--runtime', mode,
  '--target', target,
  '--arch', process.arch,
  '--platform', process.platform,
  '--verbose',
]

const { version } = require(path.join(moduleDir, 'package.json'))
console.log(`better-sqlite3 ${version} -> binaire ${mode} ${target} (${process.platform}-${process.arch})`)

try {
  execFileSync(process.execPath, args, { cwd: moduleDir, stdio: 'inherit' })
  console.log('Binaire installé.')
} catch {
  console.error(
    '\nÉchec du téléchargement du binaire.\n' +
    '- EPERM / fichier utilisé : arrête le serveur de dev et ferme l\'app, puis relance.\n' +
    '- 404 / not found : aucun binaire pour cette version d\'Electron (voir les releases de better-sqlite3).'
  )
  process.exit(1)
}