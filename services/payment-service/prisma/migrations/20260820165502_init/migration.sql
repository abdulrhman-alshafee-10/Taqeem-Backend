-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('NEW_BUSINESS_IN_RADIUS', 'PRICE_DROP', 'SLOT_OPENED', 'REVIEW_ADDED', 'LIST_ITEM_ADDED');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED');

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "AlertKind" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "params" JSONB NOT NULL,
    "quietHours" JSONB,
    "expiresAt" TIMESTAMP(3),
    "geoHash5" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertRule_user_id_status_idx" ON "AlertRule"("user_id", "status");

-- CreateIndex
CREATE INDEX "AlertRule_kind_status_idx" ON "AlertRule"("kind", "status");
