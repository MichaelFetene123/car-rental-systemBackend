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
    // Fetch booking with user details (for payload)
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: true },
    });

    if (!booking) throw new HttpException('Booking not found', 404);
    if (booking.userId !== userId) throw new ForbiddenException();
    if (booking.status !== 'pending') {
      throw new BadRequestException('Booking not payable');
    }

    const amount = booking.totalAmount.toNumber();
    const txRef = `car-${booking.bookingCode}-${randomUUID().slice(0, 8)}`;

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
    const fullName = booking.user.full_name ?? '';
    const [firstName, ...rest] = fullName.split(' ');
    const safeFirstName = firstName || 'Customer';

    const payload = {
      amount: String(amount),
      currency: 'ETB',
      email: booking.user.email,
      first_name: safeFirstName,
      last_name: rest.join(' ') || 'Customer',
      phone_number: booking.user.phone ?? '',
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
  // PARENT: VERIFY PAYMENT
  // =====================================================
  async verifyPayment(txRef: string) {
    // Call Chapa (external API)/verifyChapaPayment
    const baseUrl = this.config.get<string>('CHAPA_BASE_URL');
    const res = await fetch(`${baseUrl}/v1/transaction/verify/${txRef}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.config.get('CHAPA_SECRET_KEY')}`,
      },
    });

    const chapaData = await res.json();

    if (!res.ok) {
      throw new HttpException(
        chapaData?.message || 'Verification failed',
        HttpStatus.BAD_GATEWAY,
      );
    }
    // Chapa returns status in various cases, but we only care about 'success' or 'failed'
    const status = chapaData?.data?.status?.toLowerCase();

    // Apply result to DB (idempotent)
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
}
