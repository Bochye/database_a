-- CreateEnum
CREATE TYPE "InventoryRecordStatus" AS ENUM ('PENDING', 'APPROVED', 'RESUBMIT_REQUESTED');

-- AlterTable
ALTER TABLE "InventoryRecords" ADD COLUMN     "status" "InventoryRecordStatus" NOT NULL DEFAULT 'PENDING';
