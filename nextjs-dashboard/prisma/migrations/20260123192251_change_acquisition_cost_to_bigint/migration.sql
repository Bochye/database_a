/*
  Warnings:

  - You are about to alter the column `acquisitionCost` on the `Items` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `BigInt`.

*/
-- AlterTable
ALTER TABLE "Items" ALTER COLUMN "acquisitionCost" SET DATA TYPE BIGINT;
