-- AlterEnum Role
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DRIVER';

-- AlterEnum OrderStatus
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERY_FAILED';

-- CreateEnum PresenceStatus
DO $$ BEGIN
  CREATE TYPE "PresenceStatus" AS ENUM ('ONLINE', 'OFFLINE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- User driver fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "presence" "PresenceStatus" NOT NULL DEFAULT 'OFFLINE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastSeen" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users"("username");

-- Category
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "categories_isActive_idx" ON "categories"("isActive");
CREATE INDEX IF NOT EXISTS "categories_createdAt_idx" ON "categories"("createdAt");

-- Product
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stock" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sku" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
CREATE INDEX IF NOT EXISTS "products_createdAt_idx" ON "products"("createdAt");
CREATE INDEX IF NOT EXISTS "products_isActive_idx" ON "products"("isActive");
CREATE INDEX IF NOT EXISTS "products_sku_idx" ON "products"("sku");
CREATE INDEX IF NOT EXISTS "products_barcode_idx" ON "products"("barcode");

-- Order driver + timeline fields
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "driverId" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "pickedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);

-- Rename CustomerOrders relation: existing userId FK stays; add driver FK
DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_driverId_fkey"
    FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "orders_driverId_idx" ON "orders"("driverId");

-- DriverSession
CREATE TABLE IF NOT EXISTS "driver_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "ip" TEXT,
  "device" TEXT,
  "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "logoutAt" TIMESTAMP(3),
  CONSTRAINT "driver_sessions_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "driver_sessions" ADD CONSTRAINT "driver_sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "driver_sessions_userId_idx" ON "driver_sessions"("userId");
CREATE INDEX IF NOT EXISTS "driver_sessions_loginAt_idx" ON "driver_sessions"("loginAt");

-- OrderTimeline
CREATE TABLE IF NOT EXISTS "order_timeline" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_timeline_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "order_timeline" ADD CONSTRAINT "order_timeline_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "order_timeline" ADD CONSTRAINT "order_timeline_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "order_timeline_orderId_idx" ON "order_timeline"("orderId");
CREATE INDEX IF NOT EXISTS "order_timeline_createdAt_idx" ON "order_timeline"("createdAt");
