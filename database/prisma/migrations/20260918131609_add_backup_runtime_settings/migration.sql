-- AlterTable
ALTER TABLE "shop_settings" ADD COLUMN "backupAlertAfterHours" INTEGER;
ALTER TABLE "shop_settings" ADD COLUMN "backupAutoEnabled" BOOLEAN;
ALTER TABLE "shop_settings" ADD COLUMN "backupIntervalHours" INTEGER;
ALTER TABLE "shop_settings" ADD COLUMN "backupKeep" INTEGER;
