-- DropIndex
DROP INDEX "idx_payments_refund_reference";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "inspection_fee" DECIMAL(10,2) NOT NULL DEFAULT 0;
