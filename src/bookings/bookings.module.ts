import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '../prisma.module';
import { BookingCronService } from './booking-cron.service';

@Module({
  imports: [PrismaModule],
  providers: [BookingsService, BookingCronService],
  controllers: [BookingsController],
})
export class BookingsModule {}
