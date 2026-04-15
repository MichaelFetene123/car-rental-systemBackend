import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service';
import type { BookingStatus, Prisma } from '../generated/prisma/client';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-status.dto';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  // ===============================
  // ✅ CREATE BOOKING (USER)
  // ===============================
  async createBooking(userId: string, dto: CreateBookingDto) {
    const pickup = this.parseDateOrThrow(dto.pickupAt, 'pickupAt');
    const returnDate = this.parseDateOrThrow(dto.returnAt, 'returnAt');
    this.validateBookingWindow(pickup, returnDate);

    return this.prisma.$transaction(async (tx) => {
      await this.lockCarBookingWindow(tx, dto.carId);

      const car = await tx.car.findUnique({
        where: { id: dto.carId },
      });

      if (!car) throw new HttpException('Car not found',HttpStatus.NOT_FOUND);

      const conflict = await tx.booking.findFirst({
        where: {
          carId: dto.carId,
          status: { in: ['pending', 'approved'] },
          AND: [{ pickupAt: { lt: returnDate } }, { returnAt: { gt: pickup } }],
        },
      });

      if (conflict) {
        throw new BadRequestException(
          'Car is already booked for this time range',
        );
      }

      const totalAmount = this.calculateTotalAmount(
        car.pricePerDay,
        pickup,
        returnDate,
      );

      return tx.booking.create({
        data: {
          bookingCode: this.generateBookingCode(),
          userId,
          carId: dto.carId,
          pickupLocationId: dto.pickupLocationId,
          returnLocationId: dto.returnLocationId,
          pickupAt: pickup,
          returnAt: returnDate,
          status: 'pending',
          totalAmount,
          carNameSnapshot: car.name,
          carTypeSnapshot: car.transmission,
          carYearSnapshot: car.year,
          carImageSnapshot: car.imageUrl,
        },
      });
    });
  }

  // ===============================
  // ✅ GET USER BOOKINGS
  // ===============================
  async getMyBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: {
        pickupLocation: true,
        returnLocation: true,
      },
      orderBy: { bookedAt: 'desc' },
    });
  }

  // ===============================
  // ✅ UPDATE BOOKING (USER)
  // ===============================

  //   ✅ 7. SIMPLE HUMAN VERSION

  // This code is basically saying:
  // “Check if this car is already booked during this time.
  // If yes → reject.”

  // ✅ 8. WHY THIS IS CRITICAL

  // Without this:
  // Two users can book the same car at the same time ❌
  // Your system becomes unreliable ❌

  async updateBooking(userId: string, dto: UpdateBookingDto) {
    const pickup = this.parseDateOrThrow(dto.pickupAt, 'pickupAt');
    const returnDate = this.parseDateOrThrow(dto.returnAt, 'returnAt');
    this.validateBookingWindow(pickup, returnDate);

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: dto.bookingId },
      });

      if (!booking) throw new NotFoundException('Booking not found');

      if (booking.userId !== userId) {
        throw new ForbiddenException();
      }

      if (booking.status !== 'pending') {
          throw new HttpException(
            'Only pending bookings can be modified',
            HttpStatus.BAD_REQUEST,
          );
      }

      await this.lockCarBookingWindow(tx, booking.carId);

      const conflict = await tx.booking.findFirst({
        where: {
          carId: booking.carId,
          id: { not: booking.id },
          status: { in: ['pending', 'approved'] },
          AND: [{ pickupAt: { lt: returnDate } }, { returnAt: { gt: pickup } }],
        },
      });

      if (conflict) {
        throw new BadRequestException('Selected time slot is unavailable');
      }

      const car = await tx.car.findUnique({
        where: { id: booking.carId },
      });

      if (!car) throw new NotFoundException('Car not found');

      const totalAmount = this.calculateTotalAmount(
        car.pricePerDay,
        pickup,
        returnDate,
      );

      return tx.booking.update({
        where: { id: booking.id },
        data: {
          pickupAt: pickup,
          returnAt: returnDate,
          pickupLocationId: dto.pickupLocationId,
          returnLocationId: dto.returnLocationId,
          totalAmount,
        },
      });
    });
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
    const dayInMs = 1000 * 60 * 60 * 24;
    const durationMs = returnDate.getTime() - pickup.getTime();
    const days = Math.ceil(durationMs / dayInMs);
    return Number(pricePerDay) * days;
  }

  private generateBookingCode() {
    return `BK-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  private async lockCarBookingWindow(
    tx: Prisma.TransactionClient,
    carId: string,
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${carId}))`;
  }

  // ===============================
  // ✅ DELETE BOOKING (USER)
  // ===============================
  async deleteBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) throw new NotFoundException();

    if (booking.userId !== userId) {
      throw new ForbiddenException();
    }

    if (booking.status !== 'pending') {
      throw new HttpException('Only pending bookings can be deleted',HttpStatus.BAD_REQUEST)
    }

    return this.prisma.booking.delete({
      where: { id: bookingId },
    });
  }

  // ===============================
  // ✅ ADMIN STATUS UPDATE
  // ===============================
  async updateBookingStatus(dto: UpdateBookingStatusDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) throw new NotFoundException();

    const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
      pending: ['approved', 'rejected', 'cancelled'],
      approved: ['completed', 'cancelled'],
      rejected: [],
      cancelled: [],
      completed: [],
    };

    const allowedNext = allowedTransitions[booking.status] || [];

    if (!allowedNext.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid transition from ${booking.status} to ${dto.status}`,
      );
    }

    // ✅ TRANSACTION (CRITICAL)
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { status: dto.status },
      });

      // 🚗 CAR STATUS SYNC
      if (dto.status === 'approved') {
        await tx.car.update({
          where: { id: booking.carId },
          data: { status: 'rented' },
        });
      }

      if (dto.status === 'completed' || dto.status === 'cancelled') {
        await tx.car.update({
          where: { id: booking.carId },
          data: { status: 'available' },
        });
      }

      return updated;
    });
  }
}
