-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Country" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "iso2" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uiCoverImagePath" TEXT,
    "visited" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Country" ("id", "iso2", "name", "uiCoverImagePath") SELECT "id", "iso2", "name", "uiCoverImagePath" FROM "Country";
DROP TABLE "Country";
ALTER TABLE "new_Country" RENAME TO "Country";
CREATE UNIQUE INDEX "Country_iso2_key" ON "Country"("iso2");
CREATE TABLE "new_Place" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "visited" BOOLEAN NOT NULL DEFAULT false,
    "visitedAt" DATETIME,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "nominatimPlaceId" TEXT,
    "nominatimName" TEXT,
    CONSTRAINT "Place_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Place" ("countryId", "description", "id", "lat", "lng", "name", "nominatimName", "nominatimPlaceId", "source", "type", "visitedAt") SELECT "countryId", "description", "id", "lat", "lng", "name", "nominatimName", "nominatimPlaceId", "source", "type", "visitedAt" FROM "Place";
DROP TABLE "Place";
ALTER TABLE "new_Place" RENAME TO "Place";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
