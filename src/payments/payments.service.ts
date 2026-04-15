import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RefundDto } from './dto/refund.dto';
import { QueryPaymentDto } from './dto/query-paymnet.dto';

@Injectable()
export class PaymentsService {
  constructor(readonly prisma: PrismaService) {}

  // ===============================
  // CREATE PAYMENT
  // ===============================
  async createPayment(dto: CreatePaymentDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) {
      throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    }

    return await this.prisma.payment.create({
      data: {
        bookingId: dto.bookingId,
        invoiceNumber: `INV-${Date.now()}`,
        transactionId: `TX-${Date.now()}`,
        amount: new Prisma.Decimal(dto.amount),
        tax: new Prisma.Decimal(dto.tax ?? 0),
        fees: new Prisma.Decimal(dto.fees ?? 0),
        method: dto.method,
        status: 'pending',
      },
    });
  }

  // ===============================
  // COMPLETE PAYMENT
  // ===============================
  async completePayment(paymentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: {
          id: paymentId,
        },
      });
      if (!payment) {
        throw new HttpException('payment not found', HttpStatus.NOT_FOUND);
      }
      if (payment.status != 'pending') {
        throw new HttpException(
          'payment already  processed',
          HttpStatus.BAD_REQUEST,
        );
      }

      const updatePayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'completed',
          paidAt: new Date(),
        },
      });

      await tx.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: 'approved',
        },
      });
      return updatePayment;
    });
  }
  // ===============================
  // REFUND PAYMENT
  // ===============================

  async refund(dto: RefundDto) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: dto.paymentId },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status !== 'completed') {
        throw new BadRequestException(
          'Only completed payments can be refunded',
        );
      }

      // Convert Decimal safely
      const originalAmount = payment.amount.toNumber();

      if (dto.amount > originalAmount) {
        throw new BadRequestException('Refund exceeds original amount');
      }

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'refunded',
          refundReason: dto.reason,
        },
      });

      // Business rule: cancel booking
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: 'cancelled' },
      });

      return updated;
    });
  }

  async getStats() {
    const [completed, pending, refunded, count] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'completed' },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'pending' },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'refunded' },
      }),
      this.prisma.payment.count(),
    ]);

    return {
      totalRevenue: completed._sum.amount ?? 0,
      pendingAmount: pending._sum.amount ?? 0,
      refundedAmount: refunded._sum.amount ?? 0,
      totalTransactions: count,
    };
  }
  // ===============================
  // GET PAYMENTS (FILTER + SEARCH)
  // ===============================
  async getPayments(query: QueryPaymentDto) {
    return this.prisma.payment.findMany({
      where: {
        status: query.status,
        method: query.method,
        booking: query.search
          ? {
              user: {
                full_name: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            }
          : undefined,
      },
      include: {
        booking: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
