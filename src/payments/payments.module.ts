import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { AdminPaymentsController } from './admin/admin-payments.controller';
import { AdminPaymentsService } from './admin/admin-payments.service';
import { PrismaModule } from '../prisma.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [PrismaModule, ConfigModule, BookingsModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, AdminPaymentsService],
})
export class PaymentsModule {}
