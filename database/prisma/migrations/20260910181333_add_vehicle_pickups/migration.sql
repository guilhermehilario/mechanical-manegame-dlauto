-- CreateTable
CREATE TABLE "vehicle_pickups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workOrderId" TEXT NOT NULL,
    "receiverName" TEXT NOT NULL,
    "receiverDoc" TEXT NOT NULL,
    "receiverPhone" TEXT,
    "mileageKm" INTEGER,
    "signatureData" TEXT,
    "notes" TEXT,
    "registeredBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vehicle_pickups_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "vehicle_pickups_registeredBy_fkey" FOREIGN KEY ("registeredBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_pickups_workOrderId_key" ON "vehicle_pickups"("workOrderId");
