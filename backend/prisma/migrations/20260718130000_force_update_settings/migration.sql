-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "forceUpdate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "minIosVersion" TEXT;
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "minAndroidVersion" TEXT;
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "updateMessage" TEXT;
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "iosStoreUrl" TEXT;
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "androidStoreUrl" TEXT;
