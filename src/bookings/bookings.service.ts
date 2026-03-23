import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-status.dto';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  // ✅ CREATE BOOKING (USER)
  async createBooking(userId: string, dto: CreateBookingDto) {
    const pickup = new Date(dto.pickupAt);
    const returnDate = new Date(dto.returnAt);

    if (pickup >= returnDate) {
      throw new BadRequestException('Invalid booking dates');
    }

    // 🚨 Prevent double booking
    const conflict = await this.prisma.booking.findFirst({
      where: {
        carId: dto.carId,
        status: { in: ['pending', 'approved'] },
        AND: [{ pickupAt: { lte: returnDate } }, { returnAt: { gte: pickup } }],
      },
    });

    if (conflict) {
      throw new BadRequestException('Car already booked for selected time');
    }

    const car = await this.prisma.car.findUnique({
      where: { id: dto.carId },
    });

    if (!car) throw new NotFoundException('Car not found');

    const days =
      (returnDate.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24);

    const totalAmount = Number(car.pricePerDay) * days;

    return this.prisma.booking.create({
      data: {
        bookingCode: `BK-${Date.now()}`,
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
  }

  // ✅ USER BOOKINGS
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

  // ✅ UPDATE BOOKING (USER)
  async updateBooking(userId: string, dto: UpdateBookingDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.userId !== userId) {
      throw new ForbiddenException();
    }

    // 🚨 only pending allowed
    if (booking.status !== 'pending') {
      throw new BadRequestException('Only pending bookings can be modified');
    }

    const pickup = new Date(dto.pickupAt);
    const returnDate = new Date(dto.returnAt);

    // 🚨 conflict check
    const conflict = await this.prisma.booking.findFirst({
      where: {
        carId: booking.carId,
        id: { not: booking.id },
        status: { in: ['pending', 'approved'] },
        AND: [{ pickupAt: { lte: returnDate } }, { returnAt: { gte: pickup } }],
      },
    });

    if (conflict) {
      throw new BadRequestException('Time slot unavailable');
    }

    const car = await this.prisma.car.findUnique({
      where: { id: booking.carId },
    });

    const days =
      (returnDate.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24);

    const totalAmount = Number(car.pricePerDay) * days;

    return this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        pickupAt: pickup,
        returnAt: returnDate,
        pickupLocationId: dto.pickupLocationId,
        returnLocationId: dto.returnLocationId,
        totalAmount,
      },
    });
  }

  // ✅ DELETE BOOKING (USER)
  async deleteBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) throw new NotFoundException();

    if (booking.userId !== userId) {
      throw new ForbiddenException();
    }

    if (booking.status !== 'pending') {
      throw new BadRequestException('Cannot delete processed booking');
    }

    return this.prisma.booking.delete({
      where: { id: bookingId },
    });
  }

  // ✅ ADMIN STATUS UPDATE
  async updateBookingStatus(dto: UpdateBookingStatusDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });

    if (!booking) throw new NotFoundException();

    const allowed = {
      pending: ['approved', 'rejected', 'cancelled'],
      approved: ['completed', 'cancelled'],
      rejected: [],
      cancelled: [],
      completed: [],
    };

    if (!allowed[booking.status].includes(dto.status)) {
      throw new BadRequestException('Invalid transition');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { status: dto.status },
      });

      // sync car
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
