import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BookingCronService {
  private readonly logger = new Logger(BookingCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(process.env.BOOKING_EXPIRE_CRON ?? CronExpression.EVERY_MINUTE)
  async expirePendingBookings() {
    this.logger.log('Checking expired bookings...');

    const expiredBookings = await this.prisma.booking.findMany({
      where: {
        status: 'pending',
        expiresAt: {
          lt: new Date(),
        },
        payments: {
          some: {
            status: 'pending',
          },
        },
      },
      include: {
        payments: true,
      },
    });

    for (const booking of expiredBookings) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Re-fetch latest booking state inside transaction.
          const latestBooking = await tx.booking.findUnique({
            where: {
              id: booking.id,
            },
            include: {
              payments: true,
            },
          });

          if (!latestBooking) return;

          // Skip if already processed.
          if (latestBooking.status !== 'pending') {
            return;
          }

          const pendingPayment = latestBooking.payments.find(
            (payment) => payment.status === 'pending',
          );

          // Payment already completed.
          if (!pendingPayment) {
            return;
          }

          // Expire booking.
          await tx.booking.update({
            where: {
              id: latestBooking.id,
            },
            data: {
              status: 'expired',
            },
          });

          // Expire payments.
          await tx.payment.updateMany({
            where: {
              bookingId: latestBooking.id,
              status: 'pending',
            },
            data: {
              status: 'expired',
            },
          });

          this.logger.log(`Booking expired: ${latestBooking.id}`);
        });
      } catch (error) {
        this.logger.error(`Failed to expire booking ${booking.id}`, error);
      }
    }
  }
}
