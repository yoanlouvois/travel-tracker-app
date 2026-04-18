const fs = require('fs')
const path = require('path')
const prisma = require('../src/prisma')
const { iso3ToIso2 } = require('../shared/isoCodes')

async function main() {
  const filePath = path.join(__dirname, '..', 'public', 'countries.geo.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  const geojson = JSON.parse(raw)

  for (const feature of geojson.features) {
    const iso3 = feature.id
    const name = feature.properties?.name

    if (!iso3 || !name) continue

    const iso2 = iso3ToIso2(iso3)
    if (!iso2) {
      console.log(`Pas de correspondance iso2 pour ${iso3} (${name})`)
      continue
    }

    await prisma.country.upsert({
      where: { iso2: iso2.toUpperCase() },
      update: {
        name
      },
      create: {
        iso2: iso2.toUpperCase(),
        name,
        visited: false,
        toVisit: false
      }
    })
  }

  console.log('Seed countries terminé')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })