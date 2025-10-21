-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('USED', 'UNUSED', 'UNKNOWN', 'DISPOSED');

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

-- CreateIndex
CREATE UNIQUE INDEX "Items_assetCode_key" ON "Items"("assetCode");
