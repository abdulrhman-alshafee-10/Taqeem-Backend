-- AlterTable
ALTER TABLE "users" ADD COLUMN     "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "helpful_received" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reputation_level" TEXT NOT NULL DEFAULT 'EXPLORER',
ADD COLUMN     "reputation_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviews_count" INTEGER NOT NULL DEFAULT 0;
