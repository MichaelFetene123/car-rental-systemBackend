/*
  Warnings:

  - The values [confirmed] on the enum `BookingStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'completed');
ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "public"."BookingStatus_old";
COMMIT;

-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "booked_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "car_categories" ALTER COLUMN "last_updated" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "cars" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "locations" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user_roles" ALTER COLUMN "assigned_at" SET DEFAULT CURRENT_TIMESTAMP;
