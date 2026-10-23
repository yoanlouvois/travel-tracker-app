require('dotenv/config')

const { PrismaClient } = require('./generated/prisma')
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')

const url = process.env.DATABASE_URL || 'file:./dev.db'
const adapter = new PrismaBetterSqlite3({ url })

const prisma = new PrismaClient({ adapter })

module.exports = prisma