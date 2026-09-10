-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "appointments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "appointments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "appointments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "appointments_vehicleId_scheduledAt_idx" ON "appointments"("vehicleId", "scheduledAt");

-- CreateIndex
CREATE INDEX "appointments_customerId_idx" ON "appointments"("customerId");

-- CreateIndex
CREATE INDEX "appointments_scheduledAt_idx" ON "appointments"("scheduledAt");
