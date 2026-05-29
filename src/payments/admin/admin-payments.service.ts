import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Prisma, PaymentStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma.service';
import {
  AdminPaymentQueryDto,
  AdminPaymentSortBy,
} from '../dto/admin-payment-query.dto';
import { AdminUpdatePaymentStatusDto } from '../dto/admin-update-payment-status.dto';
import { AdminProcessPaymentRefundDto } from '../dto/admin-process-payment-refund.dto';

const REFUNDABLE_PAYMENT_STATUSES: PaymentStatus[] = [
  'completed',
  'partially_refunded',
  'refund_reversed',
];

const ALLOWED_STATUS_TRANSITIONS: Record<string, PaymentStatus[]> = {
  pending: ['completed', 'failed'],
  completed: ['refund_initiated'],
};

const DELETABLE_PAYMENT_STATUSES: PaymentStatus[] = ['completed', 'refunded'];

@Injectable()
export class AdminPaymentsService {
  private readonly logger = new Logger(AdminPaymentsService.name);
  private static refundRequestCounter = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findAll(query: AdminPaymentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit;
    const skip = limit ? (page - 1) * limit : undefined;

    const where: Prisma.PaymentWhereInput = {};

    if (query.status && query.status !== 'all') {
      where.status = query.status as PaymentStatus;
    }

    if (query.method && query.method !== 'all') {
      where.method = query.method as any;
    }

    if (query.search) {
      const search = query.search;
      where.OR = [
        {
          booking: {
            user: { full_name: { contains: search, mode: 'insensitive' } },
          },
        },
        { booking: { bookingCode: { contains: search, mode: 'insensitive' } } },
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const orderBy: Prisma.PaymentOrderByWithRelationInput = {};
    const sortBy = query.sortBy ?? AdminPaymentSortBy.CreatedAt;
    const sortOrder = query.sortOrder ?? 'desc';

    switch (sortBy) {
      case AdminPaymentSortBy.Amount:
        orderBy.amount = sortOrder;
        break;
      case AdminPaymentSortBy.Status:
        orderBy.status = sortOrder;
        break;
      case AdminPaymentSortBy.Method:
        orderBy.method = sortOrder;
        break;
      case AdminPaymentSortBy.PaidAt:
        orderBy.paidAt = sortOrder;
        break;
      default:
        orderBy.createdAt = sortOrder;
    }

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          booking: {
            select: {
              bookingCode: true,
              user: {
                select: {
                  full_name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy,
        ...(skip !== undefined ? { skip } : {}),
        ...(limit !== undefined ? { take: limit } : {}),
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: data.map((payment) => ({
        id: payment.id,
        bookingId: payment.bookingId,
        bookingCode: payment.booking.bookingCode,
        customerName: payment.booking.user.full_name ?? 'Unknown',
        customerEmail: payment.booking.user.email,
        invoiceNumber: payment.invoiceNumber,
        transactionId: payment.transactionId,
        amount: Number(payment.amount),
        tax: Number(payment.tax),
        fees: Number(payment.fees),
        refundedAmount: payment.refundedAmount
          ? Number(payment.refundedAmount)
          : 0,
        method: payment.method,
        status: payment.status,
        paidAt: payment.paidAt?.toISOString() ?? null,
        createdAt: payment.createdAt.toISOString(),
        refundReason: payment.refundReason,
        notes: payment.notes,
      })),
      meta: {
        total,
        page,
        limit: limit ?? total,
        totalPages: limit ? Math.ceil(total / limit) : 1,
      },
    };
  }

  async updateStatus(paymentId: string, dto: AdminUpdatePaymentStatusDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, status: true, amount: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const allowedNext = ALLOWED_STATUS_TRANSITIONS[payment.status];
    if (!allowedNext || !allowedNext.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition payment from '${payment.status}' to '${dto.status}'`,
      );
    }

    const updateData: Prisma.PaymentUpdateInput = {
      status: dto.status,
    };

    if (dto.notes) {
      updateData.notes = dto.notes;
    }

    if (dto.status === 'completed' && payment.status === 'pending') {
      updateData.paidAt = new Date();
    }

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: updateData,
      include: {
        booking: {
          select: {
            bookingCode: true,
            user: {
              select: { full_name: true, email: true },
            },
          },
        },
      },
    });
  }

  async processRefund(
    paymentId: string,
    dto: AdminProcessPaymentRefundDto,
    adminUserId: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        bookingId: true,
        transactionId: true,
        amount: true,
        refundedAmount: true,
        status: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (!REFUNDABLE_PAYMENT_STATUSES.includes(payment.status)) {
      throw new BadRequestException(
        `Payment is not refundable. Current status: '${payment.status}'`,
      );
    }

    const totalAmount = Number(payment.amount);
    const currentRefunded = Number(payment.refundedAmount ?? 0);
    const remainingRefund = Math.max(totalAmount - currentRefunded, 0);

    if (remainingRefund <= 0) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'refunded',
          refundedAmount: totalAmount,
          refundCompletedAt: new Date(),
          notes: 'Refund already fully settled',
        },
      });

      return {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        requestedAmount: null,
        refundedAmount: totalAmount,
        status: 'completed',
        message: 'Refund already fully settled',
      };
    }

    const requestedRefundAmount = dto.amount ?? remainingRefund;
    if (!Number.isFinite(requestedRefundAmount) || requestedRefundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }

    if (requestedRefundAmount > remainingRefund) {
      throw new BadRequestException(
        `Refund amount (${requestedRefundAmount}) exceeds remaining refundable balance (${remainingRefund})`,
      );
    }

    if (!payment.transactionId) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          refundReason: dto.reason,
          notes:
            'Refund initiation skipped: missing transaction reference. Manual review required.',
        },
      });
      await this.recordRefundAuditEvent({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        eventType: 'refund_initiation_skipped',
        requestedAmount: requestedRefundAmount,
        message: 'Missing transaction reference for refund processing',
      });

      return {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        requestedAmount: requestedRefundAmount,
        refundedAmount: 0,
        status: 'failed',
        message: 'Missing transaction reference',
      };
    }

    const requestReference = this.generateRefundRequestReference(payment.id);
    await this.recordRefundAuditEvent({
      paymentId: payment.id,
      bookingId: payment.bookingId,
      eventType: 'refund_initiation_requested',
      requestReference,
      requestedAmount: requestedRefundAmount,
      message: 'Refund initiation request submitted',
    });

    try {
      const refundResponse = await this.callChapaInitiateRefund({
        txRef: payment.transactionId,
        amount: requestedRefundAmount,
        reason: dto.reason,
        bookingId: payment.bookingId,
        paymentId: payment.id,
        requestReference,
      });

      const mappedStatus = this.mapGatewayRefundStatus(refundResponse.status);
      const nextStatus: PaymentStatus =
        mappedStatus === 'refund_processing'
          ? 'refund_processing'
          : 'refund_initiated';

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: nextStatus,
          refundReason: dto.reason,
          refundReference: refundResponse.refId ?? requestReference,
          refundRequestedAt: new Date(),
          notes: `Refund initiated (${refundResponse.status ?? 'initiated'}) for amount ${requestedRefundAmount}`,
        },
      });

      await this.recordRefundAuditEvent({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        eventType: 'refund_initiated',
        requestReference,
        refundReference: refundResponse.refId ?? requestReference,
        gatewayStatus: refundResponse.status,
        requestedAmount: requestedRefundAmount,
        message: `Refund moved to ${nextStatus}`,
        payload: refundResponse.payload,
      });

      return {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        requestedAmount: requestedRefundAmount,
        refundedAmount: 0,
        status: 'queued',
        message: `Refund initiated and moved to ${nextStatus}`,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Refund initiation failed';

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          refundReason: dto.reason,
          notes: `Refund initiation failed: ${message}. Manual review required.`,
        },
      });

      await this.recordRefundAuditEvent({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        eventType: 'refund_initiation_failed',
        requestReference,
        requestedAmount: requestedRefundAmount,
        message,
      });

      this.logger.warn(
        `Refund initiation failed for payment ${payment.id}: ${message}`,
      );

      return {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        requestedAmount: requestedRefundAmount,
        refundedAmount: 0,
        status: 'failed',
        message,
      };
    }
  }

  async deletePayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, invoiceNumber: true, status: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (!DELETABLE_PAYMENT_STATUSES.includes(payment.status)) {
      throw new BadRequestException(
        `Only completed or refunded payments can be deleted. Current status: '${payment.status}'`,
      );
    }

    await this.prisma.payment.delete({
      where: { id: paymentId },
    });

    return {
      id: payment.id,
      invoiceNumber: payment.invoiceNumber,
      status: payment.status,
      message: 'Payment deleted successfully',
    };
  }

  private async callChapaInitiateRefund(params: {
    txRef: string;
    amount: number;
    reason: string;
    bookingId: string;
    paymentId: string;
    requestReference: string;
  }): Promise<{ refId?: string; status?: string; payload?: unknown }> {
    const { baseUrl, secretKey } = this.resolveChapaConfig();

    const form = new URLSearchParams();
    form.append('reason', params.reason);
    form.append('amount', String(params.amount));
    form.append('reference', params.requestReference);
    form.append('meta[booking_id]', params.bookingId);
    form.append('meta[payment_id]', params.paymentId);

    const response = await fetch(
      `${baseUrl}/refund/${encodeURIComponent(params.txRef)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
    );

    const payload = await this.parseGatewayPayload(response);

    if (!response.ok || payload?.status !== 'success') {
      throw new Error(this.buildGatewayErrorMessage(response.status, payload));
    }

    return {
      refId: payload?.data?.ref_id,
      status:
        typeof payload?.data?.status === 'string'
          ? payload.data.status.toLowerCase()
          : undefined,
      payload,
    };
  }

  private mapGatewayRefundStatus(status?: string): PaymentStatus | null {
    if (!status) return null;

    const normalised = status.toLowerCase();

    if (normalised === 'pending' || normalised === 'queued') {
      return 'refund_processing';
    }

    if (normalised === 'success' || normalised === 'completed') {
      return 'refunded';
    }

    return null;
  }

  private resolveChapaConfig() {
    const baseUrl = this.config.get<string>('CHAPA_BASE_URL');
    const secretKey = this.config.get<string>('CHAPA_SECRET_KEY');

    if (!baseUrl || !secretKey) {
      throw new Error('Chapa configuration is missing');
    }

    return { baseUrl, secretKey };
  }

  private async parseGatewayPayload(response: Response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  private buildGatewayErrorMessage(
    statusCode: number,
    payload: { message?: string; status?: string } | null,
  ): string {
    if (payload?.message) {
      return `${payload.message} (HTTP ${statusCode})`;
    }

    if (payload?.status) {
      return `Chapa returned status '${payload.status}' (HTTP ${statusCode})`;
    }

    return `Chapa refund request failed with HTTP ${statusCode}`;
  }

  private async recordRefundAuditEvent(params: {
    paymentId: string;
    bookingId: string;
    eventType: string;
    requestReference?: string;
    refundReference?: string;
    gatewayStatus?: string;
    requestedAmount?: number;
    settledAmount?: number;
    message?: string;
    payload?: unknown;
  }) {
    await this.prisma.paymentRefundAudit.create({
      data: {
        paymentId: params.paymentId,
        bookingId: params.bookingId,
        eventType: params.eventType,
        requestReference: params.requestReference ?? null,
        refundReference: params.refundReference ?? null,
        gatewayStatus: params.gatewayStatus ?? null,
        requestedAmount: params.requestedAmount ?? null,
        settledAmount: params.settledAmount ?? null,
        message: params.message ?? null,
        payloadJson:
          params.payload != null
            ? (params.payload as Prisma.JsonObject)
            : Prisma.JsonNull,
      },
    });
  }

  private generateRefundRequestReference(paymentId: string): string {
    AdminPaymentsService.refundRequestCounter += 1;
    const counter = AdminPaymentsService.refundRequestCounter
      .toString()
      .padStart(4, '0');
    const ts = Date.now().toString(36);
    const suffix = randomUUID().slice(0, 6);
    return `REF-ADMIN-${paymentId.slice(0, 8)}-${ts}-${counter}-${suffix}`;
  }
}
