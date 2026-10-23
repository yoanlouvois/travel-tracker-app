// scripts/build-template-db.js
// Crée build/template.db : base vide, migrée, avec les pays du seed.
// Elle est embarquée dans l'app et copiée chez l'utilisateur au premier lancement.
//
// npm run db:template

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const buildDir = path.join(root, 'build')
const templateDb = path.join(buildDir, 'template.db')

fs.mkdirSync(buildDir, { recursive: true })
for (const file of [templateDb, `${templateDb}-journal`, `${templateDb}-wal`, `${templateDb}-shm`]) {
  fs.rmSync(file, { force: true })
}

// chemin absolu : la CLI Prisma et l'adaptateur better-sqlite3 ne résolvent pas
// les chemins relatifs depuis le même dossier
const env = { ...process.env, DATABASE_URL: `file:${templateDb.replace(/\\/g, '/')}` }
const run = (cmd) => execSync(cmd, { cwd: root, env, stdio: 'inherit' })

console.log('> Migrations')
run('npx prisma migrate deploy')

console.log('> Pays (seed)')
run('npm run seed:countries')

const size = Math.round(fs.statSync(templateDb).size / 1024)
console.log(`Base modèle prête : build/template.db (${size} Ko)`)
