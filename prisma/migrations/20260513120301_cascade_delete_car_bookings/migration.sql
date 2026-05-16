-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_car_id_fkey";

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_car_id_fkey" FOREIGN KEY ("car_id") REFERENCES "cars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
