/*
  Warnings:

  - A unique constraint covering the columns `[user_id,idempotency_key]` on the table `bookings` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "idempotency_key" VARCHAR(80);

-- CreateIndex
CREATE UNIQUE INDEX "uq_bookings_user_idempotency" ON "bookings"("user_id", "idempotency_key");
