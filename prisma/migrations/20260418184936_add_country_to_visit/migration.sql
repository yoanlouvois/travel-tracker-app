-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Country" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "iso2" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uiCoverImagePath" TEXT,
    "visited" BOOLEAN NOT NULL DEFAULT false,
    "toVisit" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Country" ("id", "iso2", "name", "uiCoverImagePath", "visited") SELECT "id", "iso2", "name", "uiCoverImagePath", "visited" FROM "Country";
DROP TABLE "Country";
ALTER TABLE "new_Country" RENAME TO "Country";
CREATE UNIQUE INDEX "Country_iso2_key" ON "Country"("iso2");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
