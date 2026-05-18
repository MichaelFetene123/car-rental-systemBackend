import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '../prisma.module';
import { BookingCronService } from './booking-cron.service';
import { AdminBookingsController } from './admin-bookings.controller';

@Module({
  imports: [PrismaModule],
  providers: [BookingsService, BookingCronService],
  controllers: [BookingsController, AdminBookingsController],
  exports: [BookingsService],
})
export class BookingsModule {}
