// electron/migrate.js
// Applique les migrations Prisma manquantes sur la base de l'utilisateur,
// sans la CLI Prisma (absente de l'app installée).
//
// Même fonctionnement que "prisma migrate deploy" :
// - la table _prisma_migrations liste les migrations déjà appliquées
// - chaque dossier prisma/migrations/<nom>/migration.sql absent de la table
//   est exécuté (dans une transaction), puis enregistré
// La base reste donc compatible avec la CLI Prisma (prisma migrate status, etc.).
//
// db : connexion SQLite synchrone avec exec() et prepare().all()/.run()
//      (better-sqlite3 dans l'app ; node:sqlite marche aussi)

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// table créée par Prisma (même définition que la CLI pour SQLite)
const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id"                  TEXT PRIMARY KEY NOT NULL,
  "checksum"            TEXT NOT NULL,
  "finished_at"         DATETIME,
  "migration_name"      TEXT NOT NULL,
  "logs"                TEXT,
  "rolled_back_at"      DATETIME,
  "started_at"          DATETIME NOT NULL DEFAULT current_timestamp,
  "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
)`

function listMigrations(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) return []
  return fs.readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(migrationsDir, d.name, 'migration.sql')))
    .map((d) => d.name)
    .sort() // les noms commencent par un horodatage : l'ordre alphabétique est le bon
}

// Renvoie la liste des migrations appliquées pendant cet appel
function runMigrations(db, migrationsDir) {
  db.exec(MIGRATIONS_TABLE)

  const applied = new Set(
    db.prepare('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')
      .all()
      .map((row) => row.migration_name)
  )

  const done = []

  for (const name of listMigrations(migrationsDir)) {
    if (applied.has(name)) continue

    const sql = fs.readFileSync(path.join(migrationsDir, name, 'migration.sql'), 'utf8')
    const checksum = crypto.createHash('sha256').update(sql).digest('hex')
    const startedAt = new Date().toISOString()

    db.exec('BEGIN')
    try {
      db.exec(sql)
      db.prepare(`
        INSERT INTO "_prisma_migrations"
          (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
        VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)
      `).run(crypto.randomUUID(), checksum, new Date().toISOString(), name, startedAt)
      db.exec('COMMIT')
      done.push(name)
    } catch (err) {
      db.exec('ROLLBACK')
      err.message = `Migration "${name}" impossible : ${err.message}`
      throw err
    }
  }

  return done
}

module.exports = { runMigrations, listMigrations }
