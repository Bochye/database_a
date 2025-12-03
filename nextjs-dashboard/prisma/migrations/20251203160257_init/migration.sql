-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('USED', 'UNUSED', 'UNKNOWN', 'DISPOSED');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('REPAIR', 'DISPOSAL', 'SEAL_REISSUE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Accounts" (
    "id" SERIAL NOT NULL,
    "userid" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isadmin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Items" (
    "id" SERIAL NOT NULL,
    "assetCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelNumber" TEXT,
    "acquisitionDate" TIMESTAMP(3),
    "disposalDate" TIMESTAMP(3),
    "acquisitionCost" DOUBLE PRECISION,
    "manager" TEXT,
    "location" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'USED',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "ownerid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryRecords" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "ownerId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "InventoryRecords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requests" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "requesterId" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryRequests" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "newStatus" TEXT,
    "newLocation" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryRequests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Items_assetCode_key" ON "Items"("assetCode");

-- AddForeignKey
ALTER TABLE "InventoryRecords" ADD CONSTRAINT "InventoryRecords_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requests" ADD CONSTRAINT "Requests_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryRequests" ADD CONSTRAINT "InventoryRequests_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
