import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import {
  isPaymentCovered,
  summarizePayments,
} from '../common/utils/payment-summary';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async initializePayment(userId: string, bookingId?: string) {
    if (!userId) {
      throw new HttpException(
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const pendingBookings = await this.prisma.booking.findMany({
      where: {
        userId,
        status: 'pending',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        ...(bookingId ? { id: bookingId } : {}),
      },
      include: {
        user: true,
      },
      orderBy: { bookedAt: 'asc' },
    });

    if (!pendingBookings.length) {
      throw new HttpException(
        'No pending bookings to pay',
        HttpStatus.NOT_FOUND,
      );
    }

    const txRef = `bulk-${userId}-${randomUUID().slice(0, 8)}`;

    const bookingIds = pendingBookings.map((booking) => booking.id);

    const { amount, primaryBooking } = await this.prisma.$transaction(
      async (tx) => {
        const payments = await tx.payment.findMany({
          where: {
            bookingId: { in: bookingIds },
          },
          orderBy: { createdAt: 'asc' },
        });

        const paymentsByBooking = new Map<string, typeof payments>();

        for (const payment of payments) {
          const list = paymentsByBooking.get(payment.bookingId) ?? [];
          list.push(payment);
          paymentsByBooking.set(payment.bookingId, list);
        }

        const eligibleBookings = pendingBookings.filter((booking) => {
          const summary = summarizePayments(
            paymentsByBooking.get(booking.id) ?? [],
          );
          return !isPaymentCovered(summary, booking.totalAmount);
        });

        if (!eligibleBookings.length) {
          throw new BadRequestException(
            'All pending bookings are already paid and awaiting review',
          );
        }

        const amount = eligibleBookings.reduce(
          (total, booking) => total.plus(booking.totalAmount),
          new Prisma.Decimal(0),
        );

        for (const booking of eligibleBookings) {
          if (booking.userId !== userId) {
            throw new ForbiddenException();
          }

          if (booking.status !== 'pending') {
            throw new BadRequestException('Only pending bookings can be paid');
          }

          const bookingPayments = paymentsByBooking.get(booking.id) ?? [];
          const existingPayment = [...bookingPayments]
            .reverse()
            .find((payment) => ['pending', 'failed'].includes(payment.status));

          if (existingPayment) {
            await tx.payment.update({
              where: { id: existingPayment.id },
              data: {
                transactionId: txRef,
                amount: booking.totalAmount,
                status: 'pending',
                method: 'chapa',
                notes: 'Pending payment re-initialized',
              },
            });

            continue;
          }

          await tx.payment.create({
            data: {
              bookingId: booking.id,
              transactionId: txRef,
              amount: booking.totalAmount,
              status: 'pending',
              method: 'chapa',
              notes: 'Initialized for gateway checkout',
              invoiceNumber: this.generateInvoiceNumber(booking.bookingCode),
            },
          });
        }

        return {
          amount,
          primaryBooking: eligibleBookings[0],
        };
      },
    );

    const fullName = primaryBooking.user.full_name ?? '';
    const [firstName, ...rest] = fullName.split(' ');
    const safeFirstName = firstName || 'Customer';

    const payload = {
      amount: String(amount),
      currency: 'ETB',
      email: primaryBooking.user.email,
      first_name: safeFirstName,
      last_name: rest.join(' ') || 'Customer',
      phone_number: primaryBooking.user.phone ?? '',
      tx_ref: txRef,
      callback_url: this.config.get('CHAPA_CALLBACK_URL'),
      return_url: this.config.get('CHAPA_RETURN_URL'),
    };

    const baseUrl = this.config.get<string>('CHAPA_BASE_URL');
    const secretKey = this.config.get<string>('CHAPA_SECRET_KEY');

    if (!baseUrl || !secretKey) {
      throw new HttpException(
        'Chapa configuration is missing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const response = await fetch(`${baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const gatewayResponse = await response.json();

      if (!response.ok || gatewayResponse?.status !== 'success') {
        throw new HttpException(
          gatewayResponse?.message || 'Chapa initialization failed',
          HttpStatus.BAD_GATEWAY,
        );
      }

      return {
        checkout_url: gatewayResponse.data.checkout_url,
        transactionRef: txRef,
      };
    } catch (error) {
      console.error('Chapa initialize request failed', error);
      throw new HttpException(
        'Chapa initialization request failed',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async handleCallback(query: any) {
    const txRef = query.tx_ref || query.trx_ref;
    if (!txRef) {
      throw new HttpException('Missing tx_ref', HttpStatus.BAD_REQUEST);
    }

    const baseUrl = this.config.get<string>('CHAPA_BASE_URL');
    const secretKey = this.config.get<string>('CHAPA_SECRET_KEY');

    if (!baseUrl || !secretKey) {
      throw new HttpException(
        'Chapa configuration is missing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const verifyRes = await fetch(`${baseUrl}/transaction/verify/${txRef}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    const verifyPayload = await verifyRes.json();

    if (!verifyRes.ok) {
      throw new HttpException(
        verifyPayload?.message || 'Verification failed',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const gatewayStatus = verifyPayload?.data?.status?.toLowerCase();

    return this.prisma.$transaction(async (tx) => {
      const payments = await tx.payment.findMany({
        where: { transactionId: txRef },
      });

      if (!payments.length) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      const hasPending = payments.some(
        (payment) => payment.status === 'pending',
      );
      if (!hasPending) {
        return payments;
      }

      if (gatewayStatus === 'success') {
        await tx.payment.updateMany({
          where: {
            transactionId: txRef,
            status: 'pending',
          },
          data: {
            status: 'completed',
            paidAt: new Date(),
          },
        });

        return tx.payment.findMany({
          where: { transactionId: txRef },
        });
      }

      if (gatewayStatus === 'failed') {
        await tx.payment.updateMany({
          where: {
            transactionId: txRef,
            status: 'pending',
          },
          data: { status: 'failed' },
        });

        return tx.payment.findMany({
          where: { transactionId: txRef },
        });
      }

      return payments;
    });
  }

  private generateInvoiceNumber(bookingCode: string) {
    return `INV-${bookingCode.slice(0, 12)}-${randomUUID().slice(0, 8)}`;
  }
}
