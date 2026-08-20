-- CreateEnum
CREATE TYPE "CollectionType" AS ENUM ('USER_LIST', 'EDITORIAL', 'LOCAL_GUIDE', 'AUTO');

-- CreateEnum
CREATE TYPE "CollectionVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateTable
CREATE TABLE "Collection" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "type" "CollectionType" NOT NULL DEFAULT 'USER_LIST',
    "visibility" "CollectionVisibility" NOT NULL DEFAULT 'PRIVATE',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "cover_image_url" TEXT,
    "city" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "note" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "added_by_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionCollaborator" (
    "collection_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionCollaborator_pkey" PRIMARY KEY ("collection_id","user_id")
);

-- CreateTable
CREATE TABLE "CollectionFollower" (
    "collection_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "followedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionFollower_pkey" PRIMARY KEY ("collection_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");

-- CreateIndex
CREATE INDEX "Collection_type_visibility_city_idx" ON "Collection"("type", "visibility", "city");

-- CreateIndex
CREATE INDEX "Collection_owner_id_idx" ON "Collection"("owner_id");

-- CreateIndex
CREATE INDEX "CollectionItem_collection_id_position_idx" ON "CollectionItem"("collection_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_collection_id_business_id_key" ON "CollectionItem"("collection_id", "business_id");

-- AddForeignKey
ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionCollaborator" ADD CONSTRAINT "CollectionCollaborator_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionFollower" ADD CONSTRAINT "CollectionFollower_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
