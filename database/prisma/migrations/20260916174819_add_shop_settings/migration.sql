-- CreateTable
CREATE TABLE "shop_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "documentFooter" TEXT,
    "updatedAt" DATETIME NOT NULL
);
