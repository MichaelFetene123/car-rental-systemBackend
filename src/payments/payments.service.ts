import {
  Injectable,
  HttpException,
  HttpStatus,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { Prisma } from '../generated/prisma/client';
import { randomUUID, createHmac } from 'crypto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // =====================================================
  // PARENT: INITIALIZE PAYMENT (ACCEPT PAYMENT)
  // =====================================================
  async initializePayment(userId: string) {
    const pendingBookings = await this.prisma.booking.findMany({
      where: {
        userId,
        status: 'pending',
      },
      include: { user: true },
      orderBy: { bookedAt: 'asc' },
    });

    if (!pendingBookings.length) {
      throw new HttpException('No pending bookings to pay', 404);
    }

    const amount = pendingBookings.reduce(
      (total, booking) => total.plus(booking.totalAmount),
      new Prisma.Decimal(0),
    );
    const txRef = `bulk-${userId}-${randomUUID().slice(0, 8)}`;

    const [primaryBooking] = pendingBookings;

    await this.prisma.$transaction(async (tx) => {
      for (const booking of pendingBookings) {
        if (booking.userId !== userId) throw new ForbiddenException();
        if (booking.status !== 'pending') {
          throw new BadRequestException('Booking not payable');
        }

        await tx.payment.create({
          data: {
            bookingId: booking.id,
            transactionId: txRef,
            amount: booking.totalAmount,
            status: 'pending',
            method: 'chapa',
            invoiceNumber: `INV-${booking.bookingCode.slice(0, 12)}-${randomUUID().slice(0, 8)}`,
          },
        });
      }
    });

    // Build payload (matches Chapa docs)
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

    // Call Chapa (external API)/initializeChapaPayment
    const baseUrl = this.config.get<string>('CHAPA_BASE_URL');
    const secretKey = this.config.get<string>('CHAPA_SECRET_KEY');
    if (!baseUrl || !secretKey) {
      throw new HttpException(
        'Chapa configuration is missing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const res = await fetch(`${baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const chapaResponse = await res.json();

      if (!res.ok) {
        throw new HttpException(
          chapaResponse?.message || 'Chapa initialization failed',
          HttpStatus.BAD_GATEWAY,
        );
      }

      if (chapaResponse?.status === 'success') {
        return { checkout_url: chapaResponse.data.checkout_url };
      } else {
        throw new HttpException(
          chapaResponse?.message || 'Chapa initialization failed',
          HttpStatus.BAD_GATEWAY,
        );
      }
    } catch (error) {
      console.error('Chapa initialize request failed', error);
      throw new HttpException(
        'Chapa initialization request failed',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // =====================================================
  // PARENT: CALLBACK (redirect)
  // =====================================================
  async handleCallback(query: any) {
    const txRef = query.tx_ref || query.trx_ref;
    if (!txRef) throw new HttpException('Missing tx_ref', 400);

    const baseUrl = this.config.get<string>('CHAPA_BASE_URL');
    const secretKey = this.config.get<string>('CHAPA_SECRET_KEY');
    if (!baseUrl || !secretKey) {
      throw new HttpException(
        'Chapa configuration is missing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // verify payment status with chapa (to prevent spoofing)

    const verifyRes = await fetch(`${baseUrl}/transaction/verify/${txRef}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    const chapaData = await verifyRes.json();
    // console.log(chapaData);

    if (!verifyRes.ok) {
      throw new HttpException(
        chapaData?.message || 'Verification failed',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const status = chapaData?.data?.status?.toLowerCase();

    return this.prisma.$transaction(async (tx) => {
      const payments = await tx.payment.findMany({
        where: { transactionId: txRef },
      });

      if (!payments.length) throw new HttpException('Payment not found', 404);

      const pending = payments.filter(
        (payment) => payment.status === 'pending',
      );
      if (!pending.length) return payments;

      if (status === 'success') {
        await tx.payment.updateMany({
          where: { transactionId: txRef, status: 'pending' },
          data: { status: 'completed', paidAt: new Date() },
        });

        await tx.booking.updateMany({
          where: { id: { in: payments.map((payment) => payment.bookingId) } },
          data: { status: 'approved' },
        });

        return tx.payment.findMany({ where: { transactionId: txRef } });
      }

      if (status === 'failed') {
        await tx.payment.updateMany({
          where: { transactionId: txRef, status: 'pending' },
          data: { status: 'failed' },
        });

        return tx.payment.findMany({ where: { transactionId: txRef } });
      }

      return payments;
    });
  }

  // // =====================================================
  // // PARENT: WEBHOOK (server-to-server)
  // // =====================================================
  // async handleWebhook(body: any, headers: any, rawBody?: string) {
  //   this.verifySignature(body, headers, rawBody);

  //   const txRef = body.tx_ref || body.trx_ref;
  //   if (!txRef) return { received: true };

  //   const baseUrl = this.config.get<string>('CHAPA_BASE_URL');
  //   const secretKey = this.config.get<string>('CHAPA_SECRET_KEY');
  //   if (!baseUrl || !secretKey) {
  //     throw new HttpException(
  //       'Chapa configuration is missing',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }

  //   const verifyRes = await fetch(`${baseUrl}/transaction/verify/${txRef}`, {
  //     method: 'GET',
  //     headers: { Authorization: `Bearer ${secretKey}` },
  //   });

  //   const chapaData = await verifyRes.json();
  //   console.log('Chapa verify response', {
  //     status: verifyRes.status,
  //     data: chapaData,
  //   });

  //   if (!verifyRes.ok) {
  //     throw new HttpException(
  //       chapaData?.message || 'Verification failed',
  //       HttpStatus.BAD_GATEWAY,
  //     );
  //   }

  //   const status = chapaData?.data?.status?.toLowerCase();

  //   return this.prisma.$transaction(async (tx) => {
  //     const payment = await tx.payment.findFirst({
  //       where: { transactionId: txRef },
  //     });

  //     if (!payment) throw new HttpException('Payment not found', 404);
  //     if (payment.status !== 'pending') return payment;

  //     if (status === 'success') {
  //       const updated = await tx.payment.update({
  //         where: { id: payment.id },
  //         data: {
  //           status: 'completed',
  //           paidAt: new Date(),
  //         },
  //       });

  //       await tx.booking.update({
  //         where: { id: payment.bookingId },
  //         data: { status: 'approved' },
  //       });

  //       return updated;
  //     }

  //     if (status === 'failed') {
  //       return tx.payment.update({
  //         where: { id: payment.id },
  //         data: { status: 'failed' },
  //       });
  //     }

  //     return payment;
  //   });
  // }

  // // =====================================================
  // // CHILD: VERIFY SIGNATURE
  // // =====================================================
  // private verifySignature(payload: any, headers: any, rawBody?: string) {
  //   const secret = this.config.get('CHAPA_WEBHOOK_SECRET');
  //   const signature = headers['x-chapa-signature'];

  //   if (!secret || !signature) {
  //     throw new HttpException('Invalid webhook config', 401);
  //   }

  //   const hash = createHmac('sha256', secret)
  //     .update(rawBody || JSON.stringify(payload))
  //     .digest('hex');

  //   if (hash !== signature) {
  //     throw new HttpException('Invalid signature', 401);
  //   }
  // }
}
