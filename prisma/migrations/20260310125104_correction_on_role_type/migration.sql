/*
  Warnings:

  - The `type` column on the `Role` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "role_type" AS ENUM ('admin', 'stuff', 'user');

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "type",
ADD COLUMN     "type" "role_type" NOT NULL DEFAULT 'user';

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

-- CreateIndex
CREATE INDEX "idx_roles_type" ON "Role"("type");
