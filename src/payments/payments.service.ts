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
  async initializePayment(userId: string, bookingId: string) {
    const booking = await this.getValidBooking(userId, bookingId);

    const amount = booking.totalAmount.toNumber();
    const txRef = this.generateTxRef(booking.bookingCode);

    // Save payment FIRST
    await this.prisma.payment.create({
      data: {
        bookingId,
        transactionId: txRef,
        amount: new Prisma.Decimal(amount),
        status: 'pending',
        method: 'chapa',
        invoiceNumber: `INV-${Date.now()}`,
      },
    });

    // Build payload (matches Chapa docs)
    const payload = this.buildChapaPayload(booking, txRef, amount);

    // Call child function (external API)
    const chapa = await this.initializeChapa(payload);

    return {
      checkout_url: chapa?.data?.checkout_url,
      tx_ref: txRef,
    };
  }
  
  // =====================================================
  // CHILD: BUILD PAYLOAD
  // =====================================================
  private buildChapaPayload(booking: any, txRef: string, amount: number) {
    const [firstName, ...rest] = booking.user.full_name.split(' ');

    return {
      amount: String(amount),
      currency: 'ETB',
      email: booking.user.email,
      first_name: firstName,
      last_name: rest.join(' ') || 'Customer',
      phone_number: booking.user.phone ?? '',
      tx_ref: txRef,
      callback_url: this.config.get('CHAPA_CALLBACK_URL'),
      return_url: this.config.get('CHAPA_RETURN_URL'),
      'customization[title]': 'Car rental payment',
      'customization[description]': `Booking ${booking.bookingCode}`,
      'meta[hide_receipt]': 'true',
    };
  }

  // =====================================================
  // CHILD: INITIALIZE CHAPA (POST)
  // =====================================================
  private async initializeChapa(payload: Record<string, any>) {
    const baseUrl = this.config.get<string>('CHAPA_BASE_URL');
    const res = await fetch(`${baseUrl}/v1/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.get('CHAPA_SECRET_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new HttpException(
        data?.message || 'Chapa initialization failed',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return data;
  }

  // =====================================================
  // PARENT: VERIFY PAYMENT
  // =====================================================
  async verifyPayment(txRef: string) {
    const chapaData = await this.fetchChapaVerification(txRef);
    const status = this.extractStatus(chapaData);

    return this.applyPaymentResult(txRef, status);
  }

  // =====================================================
  // CHILD: VERIFY CHAPA (GET)
  // =====================================================
  private async fetchChapaVerification(txRef: string) {
    const baseUrl = this.config.get<string>('CHAPA_BASE_URL');
    const res = await fetch(`${baseUrl}/v1/transaction/verify/${txRef}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.config.get('CHAPA_SECRET_KEY')}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      throw new HttpException(
        data?.message || 'Verification failed',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return data;
  }

  // =====================================================
  // CHILD: APPLY RESULT TO DB
  // =====================================================
  private async applyPaymentResult(txRef: string, status: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { transactionId: txRef },
      });

      if (!payment) throw new HttpException('Payment not found', 404);

      // Idempotency guard
      if (payment.status !== 'pending') return payment;

      if (status === 'success') {
        const updated = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'completed',
            paidAt: new Date(),
          },
        });

        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { status: 'approved' },
        });

        return updated;
      }

      if (status === 'failed') {
        return tx.payment.update({
          where: { id: payment.id },
          data: { status: 'failed' },
        });
      }

      return payment;
    });
  }

  // =====================================================
  // PARENT: CALLBACK (redirect)
  // =====================================================
  async handleCallback(query: any) {
    const txRef = query.tx_ref || query.trx_ref;
    if (!txRef) throw new HttpException('Missing tx_ref', 400);

    return this.verifyPayment(txRef);
  }

  // =====================================================
  // PARENT: WEBHOOK (server-to-server)
  // =====================================================
  async handleWebhook(body: any, headers: any, rawBody?: string) {
    this.verifySignature(body, headers, rawBody);

    const txRef = body.tx_ref || body.trx_ref;
    if (!txRef) return { received: true };

    return this.verifyPayment(txRef);
  }

  // =====================================================
  // CHILD: VERIFY SIGNATURE
  // =====================================================
  private verifySignature(payload: any, headers: any, rawBody?: string) {
    const secret = this.config.get('CHAPA_WEBHOOK_SECRET');
    const signature = headers['x-chapa-signature'];

    if (!secret || !signature) {
      throw new HttpException('Invalid webhook config', 401);
    }

    const hash = createHmac('sha256', secret)
      .update(rawBody || JSON.stringify(payload))
      .digest('hex');

    if (hash !== signature) {
      throw new HttpException('Invalid signature', 401);
    }
  }

  // =====================================================
  // CHILD: VALIDATE BOOKING
  // =====================================================
  private async getValidBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: true },
    });

    if (!booking) throw new HttpException('Booking not found', 404);
    if (booking.userId !== userId) throw new ForbiddenException();
    if (booking.status !== 'pending') {
      throw new BadRequestException('Booking not payable');
    }

    return booking;
  }

  // =====================================================
  // UTIL
  // =====================================================
  private generateTxRef(code: string) {
    return `car-${code}-${randomUUID().slice(0, 8)}`;
  }

  private extractStatus(data: any) {
    return data?.data?.status?.toLowerCase();
  }
}
