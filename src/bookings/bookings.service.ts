import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import {
  isPaymentCovered,
  summarizePayments,
} from '../common/utils/payment-summary';
import { AdminApproveBookingDto } from './dto/admin-approve-booking.dto';
import { AdminCancelBookingDto } from './dto/admin-cancel-booking.dto';
import { AdminCompleteBookingDto } from './dto/admin-complete-booking.dto';
import { AdminInspectBookingDto } from './dto/admin-inspect-booking.dto';
import { AdminNoShowBookingDto } from './dto/admin-no-show-booking.dto';
import { AdminPickupBookingDto } from './dto/admin-pickup-booking.dto';
import {
  AdminRejectBookingDto,
  RefundMode,
} from './dto/admin-reject-booking.dto';
import { AdminReviewQueueDto } from './dto/admin-review-queue.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-status.dto';

const DAY_IN_MS = 1000 * 60 * 60 * 24;
const BUFFER_IN_MS = DAY_IN_MS;
const BLOCKING_BOOKING_STATUSES: BookingStatus[] = ['approved', 'active'];
const REFUND_VERIFY_PAYMENT_STATUSES: PaymentStatus[] = [
  'refund_initiated',
  'refund_processing',
];
const REFUNDABLE_PAYMENT_STATUSES: PaymentStatus[] = [
  'completed',
  'partially_refunded',
  'refund_reversed',
];
const AUTO_REFUND_QUEUED_NOTE = 'Refund queued for automatic processing';

type BookingConflict = {
  id: string;
  bookingCode: string;
  pickupAt: Date;
  returnAt: Date;
  status: BookingStatus;
  conflictType: 'overlap' | 'buffer_violation';
};

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(private prisma: PrismaService) {}

  private adminBookingInclude(): Prisma.BookingInclude {
    return {
      user: {
        select: {
          id: true,
          full_name: true,
          email: true,
          phone: true,
        },
      },
      car: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          status: true,
        },
      },
      pickupLocation: {
        select: {
          name: true,
        },
      },
      returnLocation: {
        select: {
          name: true,
        },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
      },
    };
  }

  async createBooking(userId: string, dto: CreateBookingDto) {
    const pickup = this.parseDateOrThrow(dto.pickupAt, 'pickupAt');
    const returnDate = this.parseDateOrThrow(dto.returnAt, 'returnAt');
    this.validateBookingWindow(pickup, returnDate);

    const rawExpiryMinutes = Number(
      process.env.BOOKING_EXPIRE_WINDOW_MINUTES ?? 15,
    );
    const expiryMinutes =
      Number.isFinite(rawExpiryMinutes) && rawExpiryMinutes > 0
        ? rawExpiryMinutes
        : 15;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      if (dto.idempotencyKey) {
        const existing = await tx.booking.findFirst({
          where: {
            userId,
            idempotencyKey: dto.idempotencyKey,
          },
          include: {
            payments: true,
          },
        });

        if (existing) {
          return existing;
        }
      }

      await this.lockCarWorkflow(tx, dto.carId);

      const car = await tx.car.findUnique({
        where: { id: dto.carId },
        include: { category: true },
      });

      if (!car) {
        throw new HttpException('Car not found', HttpStatus.NOT_FOUND);
      }

      if (car.status === 'maintenance') {
        throw new BadRequestException(
          'Car is currently under maintenance and cannot be booked',
        );
      }

      if (car.category && !car.category.isActive) {
        throw new BadRequestException(
          'This car category is currently inactive and cannot be booked',
        );
      }

      const conflicts = await this.findConflicts(tx, {
        carId: dto.carId,
        pickup,
        returnDate,
      });

      if (conflicts.length > 0) {
        throw new BadRequestException(
          'The selected dates conflict with an approved or active booking (including 1-day buffer)',
        );
      }

      const totalAmount = this.calculateTotalAmount(
        car.pricePerDay,
        pickup,
        returnDate,
      );

      const created = await tx.booking.create({
        data: {
          bookingCode: this.generateBookingCode(),
          userId,
          carId: dto.carId,
          pickupLocationId: dto.pickupLocationId,
          returnLocationId: dto.returnLocationId,
          pickupAt: pickup,
          returnAt: returnDate,
          status: 'pending',
          expiresAt,
          totalAmount,
          idempotencyKey: dto.idempotencyKey ?? null,
          carNameSnapshot: car.name,
          carTypeSnapshot: car.transmission,
          carYearSnapshot: car.year,
          carImageSnapshot: car.imageUrl,
        },
      });

      await tx.payment.create({
        data: {
          bookingId: created.id,
          invoiceNumber: this.generateInvoiceNumber(created.bookingCode),
          amount: totalAmount,
          status: 'pending',
          method: 'chapa',
          notes: 'Initial booking payment intent',
        },
      });

      await this.logStatusTransition(tx, {
        bookingId: created.id,
        fromStatus: null,
        toStatus: 'pending',
        changedByUserId: userId,
        reason: 'Booking created',
        metadata: {
          source: 'user',
        },
      });

      return tx.booking.findUnique({
        where: { id: created.id },
        include: {
          payments: true,
          pickupLocation: true,
          returnLocation: true,
        },
      });
    });
  }

  async getMyBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        pickupLocation: true,
        returnLocation: true,
        payments: true,
      },
      orderBy: { bookedAt: 'desc' },
    });
  }

  async getAllBookings() {
    return this.prisma.booking.findMany({
      where: {
        deletedAt: null,
      },
      include: this.adminBookingInclude(),
      orderBy: { bookedAt: 'desc' },
    });
  }

  async getAdminReviewQueue(query: AdminReviewQueueDto) {
    const paidOnly = query.paidOnly === 'true';

    const pendingBookings = await this.prisma.booking.findMany({
      where: {
        status: 'pending',
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone: true,
          },
        },
        car: {
          select: {
            id: true,
            name: true,
            status: true,
            imageUrl: true,
          },
        },
        pickupLocation: true,
        returnLocation: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { bookedAt: 'asc' },
    });

    const queue = await Promise.all(
      pendingBookings.map(async (booking) => {
        const paymentSummary = summarizePayments(booking.payments);
        const hasCompletedPayment = isPaymentCovered(
          paymentSummary,
          booking.totalAmount,
        );

        const conflicts = await this.findConflicts(this.prisma, {
          carId: booking.carId,
          pickup: booking.pickupAt,
          returnDate: booking.returnAt,
          excludeBookingId: booking.id,
        });

        return {
          booking,
          paymentSummary,
          hasCompletedPayment,
          conflicts,
          hasConflicts: conflicts.length > 0,
        };
      }),
    );

    if (!paidOnly) {
      return queue;
    }

    return queue.filter((item) => item.hasCompletedPayment);
  }

  async updateBooking(userId: string, dto: UpdateBookingDto) {
    const pickup = this.parseDateOrThrow(dto.pickupAt, 'pickupAt');
    const returnDate = this.parseDateOrThrow(dto.returnAt, 'returnAt');
    this.validateBookingWindow(pickup, returnDate);

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: dto.bookingId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.userId !== userId) {
        throw new ForbiddenException();
      }

      if (booking.status !== 'pending') {
        throw new BadRequestException('Only pending bookings can be modified');
      }

      const paymentSummary = await this.getBookingPaymentSummary(
        tx,
        booking.id,
      );
      if (paymentSummary.netPaid > 0) {
        throw new BadRequestException(
          'Paid pending bookings cannot be modified during admin review',
        );
      }

      await this.lockCarWorkflow(tx, booking.carId);

      const conflicts = await this.findConflicts(tx, {
        carId: booking.carId,
        pickup,
        returnDate,
        excludeBookingId: booking.id,
      });

      if (conflicts.length > 0) {
        throw new BadRequestException(
          'Selected date range conflicts with existing approved/active bookings',
        );
      }

      const car = await tx.car.findUnique({
        where: { id: booking.carId },
      });

      if (!car) {
        throw new NotFoundException('Car not found');
      }

      const totalAmount = this.calculateTotalAmount(
        car.pricePerDay,
        pickup,
        returnDate,
      );

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          pickupAt: pickup,
          returnAt: returnDate,
          pickupLocationId: dto.pickupLocationId,
          returnLocationId: dto.returnLocationId,
          totalAmount,
        },
      });

      await tx.payment.updateMany({
        where: {
          bookingId: booking.id,
          status: 'pending',
        },
        data: {
          amount: totalAmount,
        },
      });

      return updatedBooking;
    });
  }

  async cancelBooking(
    userId: string,
    bookingId: string,
    dto?: CancelBookingDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.userId !== userId) {
        throw new ForbiddenException();
      }

      if (booking.status !== 'pending') {
        throw new BadRequestException('Only pending bookings can be cancelled');
      }

      await this.lockCarWorkflow(tx, booking.carId);

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: dto?.reason,
          reviewNote: dto?.reason ?? null,
        },
      });

      await tx.payment.updateMany({
        where: {
          bookingId: booking.id,
          status: 'pending',
        },
        data: {
          status: 'failed',
          notes: 'Cancelled before payment completion',
        },
      });

      await this.logStatusTransition(tx, {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: 'cancelled',
        changedByUserId: userId,
        reason: dto?.reason ?? 'Cancelled by user',
        metadata: {
          source: 'user',
        },
      });

      const paymentSummary = await this.getBookingPaymentSummary(
        tx,
        booking.id,
      );
      if (paymentSummary.netPaid > 0) {
        await this.refundCompletedPayments(tx, {
          bookingId: booking.id,
          reason: dto?.reason ?? 'Cancelled by user before approval',
          manualReview: false,
        });
      }

      await this.syncCarStatus(tx, booking.carId);

      return updated;
    });
  }

  async deleteBooking(
    userId: string,
    bookingId: string,
    dto?: CancelBookingDto,
  ) {
    return this.cancelBooking(userId, bookingId, dto);
  }

  async deleteExpiredBooking(adminUserId: string, bookingId: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== 'expired') {
        throw new BadRequestException(
          'Only expired bookings can be deleted by admins',
        );
      }

      return tx.booking.delete({
        where: { id: booking.id },
      });
    });
  }

  async deleteCancelledBooking(adminUserId: string, bookingId: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== 'cancelled') {
        throw new BadRequestException(
          'Only cancelled bookings can be deleted by admins',
        );
      }

      return tx.booking.delete({
        where: { id: booking.id },
      });
    });
  }

  async deleteCompletedBooking(adminUserId: string, bookingId: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== 'completed') {
        throw new BadRequestException(
          'Only completed bookings can be deleted by admins',
        );
      }

      return tx.booking.delete({
        where: { id: booking.id },
      });
    });
  }

  async deleteRejectedBooking(adminUserId: string, bookingId: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          payments: {
            select: {
              status: true,
            },
          },
        },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== 'rejected') {
        throw new BadRequestException(
          'Only rejected bookings can be deleted by admins',
        );
      }

      const hasRefundedPayment = booking.payments.some(
        (payment) => payment.status === 'refunded',
      );
      const hasPendingOrFailedRefund = booking.payments.some((payment) =>
        [
          'completed',
          'partially_refunded',
          'refund_initiated',
          'refund_processing',
          'refund_reversed',
        ].includes(payment.status),
      );

      if (!hasRefundedPayment || hasPendingOrFailedRefund) {
        throw new BadRequestException(
          'Rejected bookings can be deleted only after refund is completed',
        );
      }

      return tx.booking.delete({
        where: { id: booking.id },
      });
    });
  }

  async deleteRefundedBooking(adminUserId: string, bookingId: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          payments: true,
        },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      const paymentSummary = summarizePayments(booking.payments);
      const hasRefundSignal = booking.payments.some((payment) =>
        [
          'refunded',
          'partially_refunded',
          'refund_initiated',
          'refund_processing',
          'refund_reversed',
        ].includes(payment.status),
      );
      const hasRefundInFlight = booking.payments.some((payment) =>
        ['refund_initiated', 'refund_processing', 'refund_reversed'].includes(
          payment.status,
        ),
      );
      const isRefunded =
        paymentSummary.netPaid <= 0 && hasRefundSignal && !hasRefundInFlight;

      if (!isRefunded) {
        throw new BadRequestException(
          'Only refunded bookings can be deleted by admins',
        );
      }

      return tx.booking.delete({
        where: { id: booking.id },
      });
    });
  }

  async cancelUnpaidPendingBooking(
    adminUserId: string,
    dto: AdminCancelBookingDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: dto.bookingId },
      });

      if (!booking || booking.deletedAt) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== 'pending') {
        throw new BadRequestException(
          'Only pending bookings can be cancelled manually by admins',
        );
      }

      await this.lockCarWorkflow(tx, booking.carId);

      const paymentSummary = await this.getBookingPaymentSummary(
        tx,
        booking.id,
      );

      if (paymentSummary.totalCompleted > 0 || paymentSummary.netPaid > 0) {
        throw new BadRequestException(
          'Only unpaid pending bookings can be cancelled manually by admins',
        );
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          reviewedByUserId: adminUserId,
          cancellationReason: dto.reason ?? null,
          reviewNote: dto.reason ?? null,
        },
      });

      await tx.payment.updateMany({
        where: {
          bookingId: booking.id,
        },
        data: {
          status: 'pending',
          notes: 'Cancelled manually by admin before payment completion',
        },
      });

      await this.logStatusTransition(tx, {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: 'cancelled',
        changedByUserId: adminUserId,
        reason: dto.reason ?? 'Cancelled by admin before payment completion',
        metadata: {
          source: 'admin',
          type: 'manual_unpaid_cancellation',
        },
      });

      await this.syncCarStatus(tx, booking.carId);

      return updated;
    });
  }

  async approveBooking(adminUserId: string, dto: AdminApproveBookingDto) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: dto.bookingId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== 'pending') {
        throw new BadRequestException('Only pending bookings can be approved');
      }

      await this.lockCarWorkflow(tx, booking.carId);

      const car = await tx.car.findUnique({
        where: { id: booking.carId },
        select: { status: true },
      });

      if (!car) {
        throw new NotFoundException('Car not found');
      }

      if (car.status === 'maintenance') {
        throw new BadRequestException(
          'Car is currently under maintenance and cannot be approved',
        );
      }

      const paymentSummary = await this.getBookingPaymentSummary(
        tx,
        booking.id,
      );
      if (!isPaymentCovered(paymentSummary, booking.totalAmount)) {
        throw new BadRequestException(
          'Booking cannot be approved before payment is completed',
        );
      }

      const conflicts = await this.findConflicts(tx, {
        carId: booking.carId,
        pickup: booking.pickupAt,
        returnDate: booking.returnAt,
        excludeBookingId: booking.id,
      });

      if (conflicts.length > 0) {
        throw new BadRequestException(
          'Booking cannot be approved because of overlap or 1-day buffer conflict',
        );
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          reviewedByUserId: adminUserId,
          reviewNote: dto.reviewNote ?? null,
        },
      });

      await this.logStatusTransition(tx, {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: 'approved',
        changedByUserId: adminUserId,
        reason: dto.reviewNote ?? 'Approved by admin',
        metadata: {
          source: 'admin',
        },
      });

      await this.syncCarStatus(tx, booking.carId);
      await this.queueApprovalNotification(tx, booking.id);

      return updated;
    });
  }

  async rejectBooking(adminUserId: string, dto: AdminRejectBookingDto) {
    const refundReason = dto.reason ?? 'Booking rejected by admin';
    const refundCompletedAt = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: dto.bookingId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.deletedAt) {
        throw new NotFoundException('Booking not found');
      }

      if (!['pending', 'approved'].includes(booking.status)) {
        throw new BadRequestException(
          'Only pending or approved bookings can be rejected',
        );
      }

      const completedPayments = await tx.payment.findMany({
        where: {
          bookingId: booking.id,
          status: 'completed',
        },
        select: {
          id: true,
          amount: true,
        },
      });

      if (!completedPayments.length) {
        throw new BadRequestException(
          'Only paid pending or approved bookings can be rejected',
        );
      }

      await this.lockCarWorkflow(tx, booking.carId);

      const rejectedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'rejected',
          rejectedAt: new Date(),
          reviewedByUserId: adminUserId,
          reviewNote: refundReason,
          rejectionReason: refundReason,
        },
      });

      await tx.payment.updateMany({
        where: {
          bookingId: booking.id,
          status: 'pending',
        },
        data: {
          status: 'failed',
          notes: 'Rejected before payment completion',
        },
      });

      for (const payment of completedPayments) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            refundReason,
            status: 'refunded',
            refundedAmount: payment.amount,
            refundCompletedAt,
            notes: 'Refunded automatically on rejection',
          },
        });
      }

      await this.logStatusTransition(tx, {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: 'rejected',
        changedByUserId: adminUserId,
        reason: refundReason,
        metadata: {
          source: 'admin',
          refundMode: RefundMode.AUTO,
        },
      });

      await this.syncCarStatus(tx, booking.carId);

      return rejectedBooking;
    });

    const refreshed = await this.prisma.booking.findUnique({
      where: { id: updated.id },
      include: this.adminBookingInclude(),
    });

    return refreshed ?? updated;
  }

  async processQueuedAutoRefunds() {
    const queuedPayments = await this.prisma.payment.findMany({
      where: {
        status: {
          in: REFUNDABLE_PAYMENT_STATUSES,
        },
        notes: AUTO_REFUND_QUEUED_NOTE,
        booking: {
          status: 'rejected',
          deletedAt: null,
        },
      },
      select: {
        bookingId: true,
        refundReason: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    const processedBookingIds = new Set<string>();

    for (const queuedPayment of queuedPayments) {
      if (processedBookingIds.has(queuedPayment.bookingId)) {
        continue;
      }

      processedBookingIds.add(queuedPayment.bookingId);

      try {
        await this.processRejectedBookingRefunds({
          bookingId: queuedPayment.bookingId,
          reason: queuedPayment.refundReason ?? 'Booking rejected by admin',
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown refund error';
        this.logger.warn(
          `Automatic queued refund failed for booking ${queuedPayment.bookingId}: ${message}`,
        );
      }
    }

    return {
      totalQueuedPayments: queuedPayments.length,
      bookingsProcessed: processedBookingIds.size,
    };
  }

  async markBookingPickup(adminUserId: string, dto: AdminPickupBookingDto) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: dto.bookingId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== 'approved') {
        throw new BadRequestException(
          'Only approved bookings can be activated at pickup',
        );
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'active',
          activatedAt: new Date(),
          reviewedByUserId: adminUserId,
        },
      });

      await this.logStatusTransition(tx, {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: 'active',
        changedByUserId: adminUserId,
        reason: 'Vehicle physically picked up',
        metadata: {
          source: 'admin',
        },
      });

      await this.syncCarStatus(tx, booking.carId);

      return updated;
    });
  }

  async completeBooking(adminUserId: string, dto: AdminCompleteBookingDto) {
    const actualReturnedAt = dto.actualReturnedAt
      ? this.parseDateOrThrow(dto.actualReturnedAt, 'returnAt')
      : new Date();

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: dto.bookingId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== 'active') {
        throw new BadRequestException(
          'Only active bookings can be completed on return',
        );
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          actualReturnedAt,
          reviewedByUserId: adminUserId,
        },
      });

      await this.logStatusTransition(tx, {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: 'completed',
        changedByUserId: adminUserId,
        reason: 'Vehicle returned',
        metadata: {
          source: 'admin',
        },
      });

      await this.syncCarStatus(tx, booking.carId);

      return updated;
    });
  }

  async markBookingNoShow(adminUserId: string, dto: AdminNoShowBookingDto) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: dto.bookingId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== 'approved') {
        throw new BadRequestException(
          'Only approved bookings can be marked as no-show',
        );
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'no_show',
          noShowAt: new Date(),
          reviewedByUserId: adminUserId,
          reviewNote: dto.reason ?? null,
        },
      });

      await this.logStatusTransition(tx, {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: 'no_show',
        changedByUserId: adminUserId,
        reason: dto.reason ?? 'Marked as no-show',
        metadata: {
          source: 'admin',
        },
      });

      await this.syncCarStatus(tx, booking.carId);

      return updated;
    });
  }

  async inspectCompletedBooking(
    adminUserId: string,
    dto: AdminInspectBookingDto,
  ) {
    const extraCharges = dto.extraCharges ?? 0;
    const lateFee = dto.lateFee ?? 0;
    const inspectionFee = dto.inspectionFee ?? 0;

    if (extraCharges < 0 || lateFee < 0 || inspectionFee < 0) {
      throw new BadRequestException(
        'Inspection charges must be zero or higher',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: dto.bookingId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== 'completed') {
        throw new BadRequestException(
          'Inspection can only be recorded for completed bookings',
        );
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          extraCharges,
          lateFee,
          inspectionFee,
          damageNotes: dto.damageNotes,
          reviewedByUserId: adminUserId,
        },
      });

      const totalAdditionalAmount = extraCharges + lateFee + inspectionFee;
      const shouldCreatePayment = dto.createAdditionalPayment !== false;

      if (totalAdditionalAmount > 0 && shouldCreatePayment) {
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            invoiceNumber: this.generateInvoiceNumber(booking.bookingCode),
            amount: totalAdditionalAmount,
            tax: 0,
            fees: 0,
            method: dto.additionalPaymentMethod ?? PaymentMethod.cash,
            status: 'pending',
            notes: `Inspection charge. Late fee: ${lateFee}. Extra charges: ${extraCharges}. Inspection fee: ${inspectionFee}`,
          },
        });
      }

      return updated;
    });
  }

  async updateBookingStatus(adminUserId: string, dto: UpdateBookingStatusDto) {
    switch (dto.status) {
      case 'approved':
        return this.approveBooking(adminUserId, {
          bookingId: dto.bookingId,
          reviewNote: dto.reviewNote,
        });
      case 'rejected':
        return this.rejectBooking(adminUserId, {
          bookingId: dto.bookingId,
          reason: dto.reason,
          refundMode: dto.refundMode,
        });
      case 'active':
        return this.markBookingPickup(adminUserId, {
          bookingId: dto.bookingId,
        });
      case 'completed':
        return this.completeBooking(adminUserId, {
          bookingId: dto.bookingId,
          actualReturnedAt: dto.actualReturnedAt,
        });
      case 'cancelled':
        return this.cancelUnpaidPendingBooking(adminUserId, {
          bookingId: dto.bookingId,
          reason: dto.reason,
        });
      case 'no_show':
        return this.markBookingNoShow(adminUserId, {
          bookingId: dto.bookingId,
          reason: dto.reason,
        });
      case 'pending':
        throw new BadRequestException('Cannot transition a booking to pending');
      default:
        throw new BadRequestException('Unsupported booking status transition');
    }
  }
  async processRejectedBookingRefunds(params: {
    bookingId: string;
    reason: string;
    paymentId?: string;
    amount?: number;
  }) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: params.bookingId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!booking || booking.deletedAt) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== 'rejected') {
      throw new BadRequestException(
        'Refund processing is only allowed for rejected bookings',
      );
    }

    const refundablePaymentWhere: Prisma.PaymentWhereInput = {
      bookingId: params.bookingId,
      status: {
        in: REFUNDABLE_PAYMENT_STATUSES,
      },
    };

    if (params.paymentId) {
      refundablePaymentWhere.id = params.paymentId;
    }

    const refundablePayments = await this.prisma.payment.findMany({
      where: refundablePaymentWhere,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
      },
    });

    if (params.paymentId && refundablePayments.length === 0) {
      throw new BadRequestException(
        'Selected payment is not refundable for this rejected booking',
      );
    }

    if (params.amount !== undefined && refundablePayments.length !== 1) {
      throw new BadRequestException(
        'Provide paymentId when processing a partial refund for multiple payments',
      );
    }

    let queued = 0;
    let completed = 0;
    let failed = 0;
    let skipped = 0;

    for (const payment of refundablePayments) {
      const outcome = await this.initiateRefundForPayment({
        paymentId: payment.id,
        reason: params.reason,
        amount: params.amount,
      });

      if (outcome === 'queued') {
        queued += 1;
      } else if (outcome === 'completed') {
        completed += 1;
      } else if (outcome === 'failed') {
        failed += 1;
      } else if (outcome === 'skipped') {
        skipped += 1;
      }
    }

    return {
      bookingId: params.bookingId,
      paymentId: params.paymentId ?? null,
      requestedAmount: params.amount ?? null,
      total: refundablePayments.length,
      queued,
      completed,
      failed,
      skipped,
    };
  }

  async verifyPendingRefunds() {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: {
          in: REFUND_VERIFY_PAYMENT_STATUSES,
        },
        refundReference: {
          not: null,
        },
      },
      select: {
        id: true,
        bookingId: true,
        status: true,
        amount: true,
        refundedAmount: true,
        refundReference: true,
      },
      take: 100,
      orderBy: { createdAt: 'asc' },
    });

    for (const payment of payments) {
      const refundReference = payment.refundReference;
      if (!refundReference) {
        continue;
      }

      try {
        const verification = await this.callChapaVerifyRefund(refundReference);
        const mappedStatus = this.mapGatewayRefundStatus(verification.status);

        if (!mappedStatus) {
          continue;
        }

        if (mappedStatus === 'refunded') {
          const totalAmount = Number(payment.amount);
          const currentRefunded = Number(payment.refundedAmount);
          const remaining = Math.max(totalAmount - currentRefunded, 0);
          const verifiedAmount =
            typeof verification.amount === 'number' &&
            Number.isFinite(verification.amount) &&
            verification.amount > 0
              ? verification.amount
              : remaining;
          const settledAmount = Math.min(verifiedAmount, remaining);
          const nextRefunded = Math.min(
            currentRefunded + settledAmount,
            totalAmount,
          );

          const updateData: Prisma.PaymentUpdateInput = {
            status:
              nextRefunded >= totalAmount ? 'refunded' : 'partially_refunded',
            refundedAmount: nextRefunded,
            notes: `Refund status verified as ${verification.status}`,
          };

          if (nextRefunded >= totalAmount) {
            updateData.refundCompletedAt = new Date();
          }

          await this.prisma.payment.update({
            where: { id: payment.id },
            data: updateData,
          });
          await this.recordRefundAuditEvent({
            paymentId: payment.id,
            bookingId: payment.bookingId,
            eventType: 'refund_verified',
            refundReference,
            gatewayStatus: verification.status,
            settledAmount,
            message: `Verification moved payment to ${updateData.status}`,
            payload: verification.payload,
          });
          continue;
        }

        const updateData: Prisma.PaymentUpdateInput = {
          status: mappedStatus,
          notes: `Refund status verified as ${verification.status}`,
        };

        await this.prisma.payment.update({
          where: { id: payment.id },
          data: updateData,
        });
        await this.recordRefundAuditEvent({
          paymentId: payment.id,
          bookingId: payment.bookingId,
          eventType: 'refund_verified',
          refundReference,
          gatewayStatus: verification.status,
          message: `Verification moved payment to ${mappedStatus}`,
          payload: verification.payload,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown refund error';
        await this.recordRefundAuditEvent({
          paymentId: payment.id,
          bookingId: payment.bookingId,
          eventType: 'refund_verify_failed',
          refundReference,
          message,
        });
        this.logger.warn(
          `Refund verify failed for payment ${payment.id}: ${message}`,
        );
      }
    }
  }

  private parseDateOrThrow(value: string, fieldName: 'pickupAt' | 'returnAt') {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new HttpException(
        `${fieldName} must be a valid datetime`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return date;
  }

  private validateBookingWindow(pickup: Date, returnDate: Date) {
    if (pickup >= returnDate) {
      throw new HttpException(
        'Return time must be after pickup time',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private calculateTotalAmount(
    pricePerDay: Prisma.Decimal,
    pickup: Date,
    returnDate: Date,
  ) {
    const durationMs = returnDate.getTime() - pickup.getTime();
    const days = Math.ceil(durationMs / DAY_IN_MS);
    return Number(pricePerDay) * days;
  }

  private generateBookingCode() {
    return `BK-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  private generateInvoiceNumber(bookingCode: string) {
    return `INV-${bookingCode.slice(0, 12)}-${randomUUID().slice(0, 8)}`;
  }

  private async findConflicts(
    tx: Prisma.TransactionClient | PrismaService,
    params: {
      carId: string;
      pickup: Date;
      returnDate: Date;
      excludeBookingId?: string;
    },
  ): Promise<BookingConflict[]> {
    const windowStart = new Date(params.pickup.getTime() - BUFFER_IN_MS);
    const windowEnd = new Date(params.returnDate.getTime() + BUFFER_IN_MS);

    const where: Prisma.BookingWhereInput = {
      carId: params.carId,
      status: { in: BLOCKING_BOOKING_STATUSES },
      pickupAt: { lt: windowEnd },
      returnAt: { gt: windowStart },
    };

    if (params.excludeBookingId) {
      where.id = { not: params.excludeBookingId };
    }

    const candidates = await tx.booking.findMany({
      where,
      select: {
        id: true,
        bookingCode: true,
        pickupAt: true,
        returnAt: true,
        status: true,
      },
      orderBy: { pickupAt: 'asc' },
    });

    return candidates
      .map((candidate) => {
        const overlap =
          params.pickup < candidate.returnAt &&
          params.returnDate > candidate.pickupAt;

        if (overlap) {
          return {
            ...candidate,
            conflictType: 'overlap' as const,
          };
        }

        const gapMs =
          params.returnDate <= candidate.pickupAt
            ? candidate.pickupAt.getTime() - params.returnDate.getTime()
            : params.pickup.getTime() - candidate.returnAt.getTime();

        if (gapMs < BUFFER_IN_MS) {
          return {
            ...candidate,
            conflictType: 'buffer_violation' as const,
          };
        }

        return null;
      })
      .filter((item): item is BookingConflict => Boolean(item));
  }

  private async getBookingPaymentSummary(
    tx: Prisma.TransactionClient,
    bookingId: string,
  ) {
    const payments = await tx.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
    });

    return summarizePayments(payments);
  }

  private async initiateRefundForPayment(params: {
    paymentId: string;
    reason: string;
    amount?: number;
  }): Promise<'queued' | 'completed' | 'failed' | 'skipped'> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: params.paymentId },
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
      return 'skipped';
    }

    if (!REFUNDABLE_PAYMENT_STATUSES.includes(payment.status)) {
      return 'skipped';
    }

    const totalAmount = Number(payment.amount);
    const currentRefunded = Number(payment.refundedAmount);
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

      return 'completed';
    }

    const requestedRefundAmount = params.amount ?? remainingRefund;
    if (!Number.isFinite(requestedRefundAmount) || requestedRefundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }

    if (requestedRefundAmount > remainingRefund) {
      throw new BadRequestException(
        `Refund amount exceeds remaining refundable balance for payment ${payment.id}`,
      );
    }

    if (!payment.transactionId) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          refundReason: params.reason,
          notes:
            'Automatic refund initiation skipped: missing transaction reference. Manual review required.',
        },
      });
      await this.recordRefundAuditEvent({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        eventType: 'refund_initiation_skipped',
        requestedAmount: requestedRefundAmount,
        message: 'Missing transaction reference for refund processing',
      });

      return 'failed';
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
        reason: params.reason,
        bookingId: payment.bookingId,
        paymentId: payment.id,
        requestReference,
      });

      const mappedStatus = this.mapGatewayRefundStatus(refundResponse.status);
      const nextStatus: PaymentStatus =
        mappedStatus === 'refund_processing'
          ? 'refund_processing'
          : 'refund_initiated';

      const updateData: Prisma.PaymentUpdateInput = {
        status: nextStatus,
        refundReason: params.reason,
        refundReference: refundResponse.refId ?? requestReference,
        refundRequestedAt: new Date(),
        notes: `Refund initiated (${refundResponse.status ?? 'initiated'}) for amount ${requestedRefundAmount}`,
      };

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: updateData,
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

      return 'queued';
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Refund initiation failed';

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          refundReason: params.reason,
          notes: `Automatic refund initiation failed: ${message}. Manual review required.`,
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

      return 'failed';
    }
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

  private async callChapaVerifyRefund(refId: string): Promise<{
    status: string;
    amount?: number;
    payload?: unknown;
  }> {
    const { baseUrl, secretKey } = this.resolveChapaConfig();
    const response = await fetch(
      `${baseUrl}/refund/${encodeURIComponent(refId)}/verify`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );

    const payload = await this.parseGatewayPayload(response);

    if (!response.ok || payload?.status !== 'success') {
      throw new Error(this.buildGatewayErrorMessage(response.status, payload));
    }

    return {
      status:
        typeof payload?.data?.status === 'string'
          ? payload.data.status.toLowerCase()
          : 'initiated',
      amount:
        typeof payload?.data?.amount === 'number'
          ? payload.data.amount
          : typeof payload?.data?.amount === 'string'
            ? Number(payload.data.amount)
            : undefined,
      payload,
    };
  }

  private mapGatewayRefundStatus(status?: string): PaymentStatus | null {
    if (!status) {
      return null;
    }

    switch (status.toLowerCase()) {
      case 'initiated':
        return 'refund_initiated';
      case 'processing':
        return 'refund_processing';
      case 'refunded':
        return 'refunded';
      case 'reversed':
        return 'refund_reversed';
      default:
        return null;
    }
  }

  private resolveChapaConfig() {
    const baseUrl = process.env.CHAPA_BASE_URL;
    const secretKey = process.env.CHAPA_SECRET_KEY;

    if (!baseUrl || !secretKey) {
      throw new Error('Chapa configuration is missing');
    }

    return {
      baseUrl: this.normalizeChapaBaseUrl(baseUrl),
      secretKey,
    };
  }

  private normalizeChapaBaseUrl(url: string) {
    return url.replace(/\/+$/, '');
  }

  private async parseGatewayPayload(response: Response) {
    const bodyText = await response.text();

    if (!bodyText) {
      return null;
    }

    try {
      return JSON.parse(bodyText);
    } catch {
      return {
        message: bodyText,
      };
    }
  }

  private buildGatewayErrorMessage(statusCode: number, payload: unknown) {
    const payloadMessage =
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : null;

    return payloadMessage ?? `Gateway error (${statusCode})`;
  }

  private normalizeAuditPayload(
    payload: unknown,
  ): Prisma.InputJsonValue | undefined {
    if (payload === undefined) {
      return undefined;
    }

    try {
      return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
    } catch {
      return undefined;
    }
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
    const auditDelegate = (
      this.prisma as unknown as {
        paymentRefundAudit?: {
          create?: (args: unknown) => Promise<unknown>;
        };
      }
    ).paymentRefundAudit;

    if (!auditDelegate?.create) {
      return;
    }

    try {
      await auditDelegate.create({
        data: {
          paymentId: params.paymentId,
          bookingId: params.bookingId,
          eventType: params.eventType,
          requestReference: params.requestReference,
          refundReference: params.refundReference,
          gatewayStatus: params.gatewayStatus,
          requestedAmount:
            params.requestedAmount !== undefined
              ? new Prisma.Decimal(params.requestedAmount)
              : undefined,
          settledAmount:
            params.settledAmount !== undefined
              ? new Prisma.Decimal(params.settledAmount)
              : undefined,
          message: params.message,
          payloadJson: this.normalizeAuditPayload(params.payload),
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown refund audit error';
      this.logger.warn(`Failed to persist refund audit event: ${message}`);
    }
  }

  private generateRefundRequestReference(paymentId: string) {
    return `REF-${paymentId.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
  }

  private async refundCompletedPayments(
    tx: Prisma.TransactionClient,
    params: {
      bookingId: string;
      reason: string;
      manualReview: boolean;
    },
  ) {
    const refundablePayments = await tx.payment.findMany({
      where: {
        bookingId: params.bookingId,
        status: {
          in: ['completed', 'partially_refunded'],
        },
      },
    });

    for (const payment of refundablePayments) {
      const currentRefunded = Number(payment.refundedAmount);
      const totalAmount = Number(payment.amount);
      const remainingRefund = Math.max(totalAmount - currentRefunded, 0);

      if (remainingRefund <= 0) {
        if (payment.status !== 'refunded') {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'refunded',
            },
          });
        }

        continue;
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'refunded',
          refundedAmount: currentRefunded + remainingRefund,
          refundReason: params.reason,
          notes: params.manualReview
            ? 'Manual refund review required by admin'
            : 'Refund processed automatically',
        },
      });
    }
  }

  private async queueApprovalNotification(
    tx: Prisma.TransactionClient,
    bookingId: string,
  ) {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!booking) {
      return;
    }

    if (booking.user.email) {
      await tx.notificationLog.create({
        data: {
          booking_id: booking.id,
          user_id: booking.user.id,
          type: 'email',
          recipient: booking.user.email,
          subject: 'Your booking has been approved',
          status: 'pending',
        },
      });

      return;
    }

    if (booking.user.phone) {
      await tx.notificationLog.create({
        data: {
          booking_id: booking.id,
          user_id: booking.user.id,
          type: 'sms',
          recipient: booking.user.phone,
          subject: 'Your booking has been approved',
          status: 'pending',
        },
      });
    }
  }

  private async logStatusTransition(
    tx: Prisma.TransactionClient,
    params: {
      bookingId: string;
      fromStatus: BookingStatus | null;
      toStatus: BookingStatus;
      changedByUserId?: string;
      reason?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    await tx.bookingStatusTransition.create({
      data: {
        bookingId: params.bookingId,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        changedByUserId: params.changedByUserId,
        reason: params.reason,
        metadataJson: params.metadata,
      },
    });
  }

  private async syncCarStatus(tx: Prisma.TransactionClient, carId: string) {
    const car = await tx.car.findUnique({
      where: { id: carId },
      select: { status: true },
    });

    if (!car) {
      return;
    }

    if (car.status === 'maintenance') {
      return;
    }

    const activeBookingCount = await tx.booking.count({
      where: {
        carId,
        status: {
          in: BLOCKING_BOOKING_STATUSES,
        },
      },
    });

    const nextStatus = activeBookingCount > 0 ? 'rented' : 'available';

    await tx.car.update({
      where: { id: carId },
      data: {
        status: nextStatus,
      },
    });
  }

  private async lockCarWorkflow(tx: Prisma.TransactionClient, carId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${carId}))`;
  }
}
