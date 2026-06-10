import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { BookingsService } from './bookings.service';

const EVERY_MINUTE_AT_SECOND_20 = '20 * * * * *';
const EVERY_MINUTE_AT_SECOND_40 = '40 * * * * *';

@Injectable()
export class BookingCronService {
  private readonly logger = new Logger(BookingCronService.name);
  private readonly runningJobs = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Cron(process.env.BOOKING_EXPIRE_CRON ?? CronExpression.EVERY_MINUTE)
  async expirePendingBookings() {
    await this.runCronJob('expire pending bookings', async () => {
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
          this.logCronError(`Failed to expire booking ${booking.id}`, error);
        }
      }
    });
  }

  @Cron(process.env.BOOKING_REFUND_VERIFY_CRON ?? EVERY_MINUTE_AT_SECOND_20)
  async verifyRefundStatuses() {
    await this.runCronJob('verify pending refunds', async () => {
      this.logger.log('Checking pending refund statuses...');
      await this.bookingsService.verifyPendingRefunds();
    });
  }

  @Cron(process.env.BOOKING_AUTO_REFUND_CRON ?? EVERY_MINUTE_AT_SECOND_40)
  async processQueuedAutoRefunds() {
    await this.runCronJob('process queued automatic refunds', async () => {
      this.logger.log(
        'Processing queued automatic refunds for rejected bookings...',
      );

      await this.bookingsService.processQueuedAutoRefunds();
    });
  }

  private async runCronJob(jobName: string, callback: () => Promise<void>) {
    if (this.runningJobs.has(jobName)) {
      this.logger.warn(`Skipping ${jobName}; previous run is still active.`);
      return;
    }

    this.runningJobs.add(jobName);

    try {
      await callback();
    } catch (error) {
      this.logCronError(`Failed to ${jobName}`, error);
    } finally {
      this.runningJobs.delete(jobName);
    }
  }

  private logCronError(message: string, error: unknown) {
    if (error instanceof Error) {
      this.logger.error(message, error.stack);
      return;
    }

    this.logger.error(message, String(error));
  }
}
