/*
  Warnings:

  - A unique constraint covering the columns `[tripId,orderIndex]` on the table `TripStop` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "TripStop_tripId_orderIndex_idx";

-- CreateIndex
CREATE UNIQUE INDEX "TripStop_tripId_orderIndex_key" ON "TripStop"("tripId", "orderIndex");
