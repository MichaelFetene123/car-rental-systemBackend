import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  BookingStatus,
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
  constructor(private prisma: PrismaService) {}

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
      });

      if (!car) {
        throw new HttpException('Car not found', HttpStatus.NOT_FOUND);
      }

      if (car.status === 'maintenance') {
        throw new BadRequestException(
          'Car is currently under maintenance and cannot be booked',
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
      },
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

      if (!booking || booking.deletedAt) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== 'expired') {
        throw new BadRequestException(
          'Only expired bookings can be deleted by admins',
        );
      }

      return tx.booking.update({
        where: { id: booking.id },
        data: {
          deletedAt: new Date(),
          reviewedByUserId: adminUserId,
          idempotencyKey: null,
        },
      });
    });
  }

  async deleteCancelledBooking(adminUserId: string, bookingId: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking || booking.deletedAt) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== 'cancelled') {
        throw new BadRequestException(
          'Only cancelled bookings can be deleted by admins',
        );
      }

      return tx.booking.update({
        where: { id: booking.id },
        data: {
          deletedAt: new Date(),
          reviewedByUserId: adminUserId,
          idempotencyKey: null,
        },
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
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: dto.bookingId },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      if (booking.status !== 'pending') {
        throw new BadRequestException('Only pending bookings can be rejected');
      }

      await this.lockCarWorkflow(tx, booking.carId);

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'rejected',
          rejectedAt: new Date(),
          reviewedByUserId: adminUserId,
          reviewNote: dto.reason ?? null,
          rejectionReason: dto.reason ?? null,
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

      await this.logStatusTransition(tx, {
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: 'rejected',
        changedByUserId: adminUserId,
        reason: dto.reason ?? 'Rejected by admin',
        metadata: {
          source: 'admin',
        },
      });

      const paymentSummary = await this.getBookingPaymentSummary(
        tx,
        booking.id,
      );
      if (paymentSummary.netPaid > 0) {
        await this.refundCompletedPayments(tx, {
          bookingId: booking.id,
          reason: dto.reason ?? 'Booking rejected by admin',
          manualReview: dto.refundMode === RefundMode.MANUAL_REVIEW,
        });
      }

      await this.syncCarStatus(tx, booking.carId);

      return updated;
    });
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
          damageNotes: dto.damageNotes,
          reviewedByUserId: adminUserId,
        },
      });

      const totalAdditionalAmount = extraCharges + lateFee;
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
            notes: `Inspection charge. Late fee: ${lateFee}. Extra charges: ${extraCharges}`,
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
