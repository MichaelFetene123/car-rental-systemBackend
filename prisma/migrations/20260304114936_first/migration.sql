/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - The `id` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `email` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to drop the `Post` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `full_name` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "car_status" AS ENUM ('available', 'rented', 'maintenance');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'approved', 'rejected', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('credit_card', 'mobile_money', 'cash');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed', 'refunded', 'failed');

-- CreateEnum
CREATE TYPE "NotificationTemplateType" AS ENUM ('email', 'sms');

-- CreateEnum
CREATE TYPE "NotificationLogStatus" AS ENUM ('sent', 'failed', 'pending');

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_authorId_fkey";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "name",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "full_name" VARCHAR(120) NOT NULL,
ADD COLUMN     "phone" VARCHAR(30),
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'active',
ADD COLUMN     "total_bookings" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "Post";

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "user_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" VARCHAR(60) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "zip_code" VARCHAR(20) NOT NULL,
    "phone" VARCHAR(30),
    "email" VARCHAR(255),
    "opening_hours" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "car_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(60) NOT NULL,
    "description" TEXT,
    "vehicles" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_updated" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "car_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cars" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "category_id" UUID,
    "year" SMALLINT NOT NULL,
    "seats" SMALLINT NOT NULL,
    "fuel_type" VARCHAR(40),
    "transmission" VARCHAR(40) NOT NULL,
    "price_per_day" DECIMAL(10,2) NOT NULL,
    "status" "car_status" NOT NULL DEFAULT 'available',
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "image_url" TEXT,
    "description" TEXT,
    "home_location_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_code" VARCHAR(40) NOT NULL,
    "user_id" UUID NOT NULL,
    "car_id" UUID NOT NULL,
    "pickup_location_id" UUID,
    "return_location_id" UUID,
    "pickup_at" TIMESTAMP(6) NOT NULL,
    "return_at" TIMESTAMP(6) NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "booked_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "car_name_snapshot" VARCHAR(120),
    "car_type_snapshot" VARCHAR(60),
    "car_year_snapshot" SMALLINT,
    "car_image_snapshot" TEXT,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "invoice_number" VARCHAR(40) NOT NULL,
    "transaction_id" VARCHAR(80),
    "amount" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fees" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "paid_at" TIMESTAMP(6),
    "refund_reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "type" "NotificationTemplateType" NOT NULL,
    "trigger_event" VARCHAR(80) NOT NULL,
    "subject" VARCHAR(255),
    "content" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "template_id" UUID,
    "user_id" UUID,
    "booking_id" UUID,
    "type" "NotificationTemplateType" NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(255),
    "status" "NotificationLogStatus" NOT NULL,
    "sent_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_message" TEXT,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_channel_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel" "NotificationTemplateType" NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "config_json" JSONB NOT NULL DEFAULT '{}',
    "from_name" VARCHAR(120),
    "from_email" VARCHAR(255),
    "from_number" VARCHAR(30),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_channel_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "idx_roles_type" ON "Role"("type");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "idx_locations_active" ON "locations"("is_active");

-- CreateIndex
CREATE INDEX "idx_locations_city_state" ON "locations"("city", "state");

-- CreateIndex
CREATE UNIQUE INDEX "locations_name_city_state_key" ON "locations"("name", "city", "state");

-- CreateIndex
CREATE UNIQUE INDEX "car_categories_name_key" ON "car_categories"("name");

-- CreateIndex
CREATE INDEX "idx_categories_name" ON "car_categories"("name");

-- CreateIndex
CREATE INDEX "idx_cars_status" ON "cars"("status");

-- CreateIndex
CREATE INDEX "idx_cars_category" ON "cars"("category_id");

-- CreateIndex
CREATE INDEX "idx_cars_home_location" ON "cars"("home_location_id");

-- CreateIndex
CREATE INDEX "idx_cars_price" ON "cars"("price_per_day");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_booking_code_key" ON "bookings"("booking_code");

-- CreateIndex
CREATE INDEX "idx_bookings_user_time" ON "bookings"("user_id", "booked_at");

-- CreateIndex
CREATE INDEX "idx_bookings_car_dates" ON "bookings"("car_id", "pickup_at", "return_at");

-- CreateIndex
CREATE INDEX "idx_bookings_status" ON "bookings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_invoice_number_key" ON "payments"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_id_key" ON "payments"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_payments_booking" ON "payments"("booking_id");

-- CreateIndex
CREATE INDEX "idx_payments_status" ON "payments"("status");

-- CreateIndex
CREATE INDEX "idx_payments_paid_at" ON "payments"("paid_at");

-- CreateIndex
CREATE INDEX "idx_notif_logs_status" ON "notification_logs"("status");

-- CreateIndex
CREATE INDEX "idx_notif_logs_sent_at" ON "notification_logs"("sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_channel_settings_channel_key" ON "notification_channel_settings"("channel");

-- CreateIndex
CREATE INDEX "idx_users_status" ON "User"("status");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cars" ADD CONSTRAINT "cars_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "car_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cars" ADD CONSTRAINT "cars_home_location_id_fkey" FOREIGN KEY ("home_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "cars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_pickup_location_id_fkey" FOREIGN KEY ("pickup_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_return_location_id_fkey" FOREIGN KEY ("return_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
