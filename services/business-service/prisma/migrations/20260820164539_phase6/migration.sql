-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "aspect_avg_ambience" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "aspect_avg_cleanliness" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "aspect_avg_food" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "aspect_avg_service" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "aspect_avg_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "aspect_count_ambience" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aspect_count_cleanliness" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aspect_count_food" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aspect_count_service" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "aspect_count_value" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "atmosphere" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "dietary" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "payment_methods" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "businesses_features_idx" ON "businesses" USING GIN ("features");

-- CreateIndex
CREATE INDEX "businesses_dietary_idx" ON "businesses" USING GIN ("dietary");

-- CreateIndex
CREATE INDEX "businesses_atmosphere_idx" ON "businesses" USING GIN ("atmosphere");

-- CreateIndex
CREATE INDEX "businesses_payment_methods_idx" ON "businesses" USING GIN ("payment_methods");
