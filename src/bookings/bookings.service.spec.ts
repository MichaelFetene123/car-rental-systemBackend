import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma.service';
import { RefundMode } from './dto/admin-reject-booking.dto';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: { $transaction: jest.Mock };

  const baseDto = {
    carId: 'car-1',
    pickupLocationId: 'pickup-1',
    returnLocationId: 'return-1',
    pickupAt: '2026-06-01T10:00:00.000Z',
    returnAt: '2026-06-05T10:00:00.000Z',
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  it('returns existing booking for matching idempotency key', async () => {
    const existing = { id: 'booking-1', bookingCode: 'BK-1' };

    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ status: 'active' }),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue(existing),
      },
    };

    prisma.$transaction.mockImplementation(
      async <TResult>(handler: (client: typeof tx) => Promise<TResult>) =>
        handler(tx),
    );

    const result = await service.createBooking('user-1', {
      ...baseDto,
      idempotencyKey: 'idem-1',
    });

    expect(result).toEqual(existing);
    expect(tx.booking.findFirst).toHaveBeenCalledTimes(1);
  });

  it('rejects createBooking when pickup location is inactive', async () => {
    const tx = {
      user: { findUnique: jest.fn().mockResolvedValue({ status: 'active' }) },
      booking: {
        findFirst: jest.fn().mockResolvedValueOnce(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'booking-3', bookingCode: 'BK-3' }),
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'booking-3', bookingCode: 'BK-3' }),
      },
      car: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'car-1',
          status: 'available',
          name: 'Sedan',
          transmission: 'automatic',
          year: 2024,
          imageUrl: 'https://example.com/car.png',
          pricePerDay: 100,
        }),
      },
      payment: { create: jest.fn() },
      bookingStatusTransition: { create: jest.fn() },
      location: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'pickup-1', isActive: false }),
      },
      $executeRaw: jest.fn(),
    };

    prisma.$transaction.mockImplementation(
      async <TResult>(handler: (client: typeof tx) => Promise<TResult>) =>
        handler(tx),
    );

    await expect(service.createBooking('user-1', baseDto)).rejects.toThrow(
      'Pickup location is inactive and cannot be used for bookings',
    );
  });

  it('rejects updateBooking when return location is inactive', async () => {
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-update-1',
          userId: 'user-1',
          status: 'pending',
          carId: 'car-1',
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      car: {
        findUnique: jest.fn().mockResolvedValue({ pricePerDay: 120 }),
      },
      location: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where: { id } }) =>
            id === 'return-1'
              ? Promise.resolve({ id: 'return-1', isActive: false })
              : Promise.resolve({ id: 'pickup-1', isActive: true }),
          ),
      },
      $executeRaw: jest.fn(),
    };

    prisma.$transaction.mockImplementation(
      async <TResult>(handler: (client: typeof tx) => Promise<TResult>) =>
        handler(tx),
    );

    await expect(
      service.updateBooking('user-1', {
        bookingId: 'booking-update-1',
        pickupAt: '2026-06-02T10:00:00.000Z',
        returnAt: '2026-06-04T10:00:00.000Z',
        pickupLocationId: 'pickup-1',
        returnLocationId: 'return-1',
      }),
    ).rejects.toThrow(
      'Return location is inactive and cannot be used for bookings',
    );
  });

  it('creates booking and pending payment when no idempotent match exists', async () => {
    const createdBooking = {
      id: 'booking-2',
      bookingCode: 'BK-2',
      payments: [{ id: 'payment-1', status: 'pending' }],
    };

    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ status: 'active' }),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValueOnce(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'booking-2', bookingCode: 'BK-2' }),
        findUnique: jest.fn().mockResolvedValue(createdBooking),
      },
      car: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'car-1',
          status: 'available',
          name: 'Sedan',
          transmission: 'automatic',
          year: 2024,
          imageUrl: 'https://example.com/car.png',
          pricePerDay: 100,
        }),
      },
      payment: {
        create: jest.fn(),
      },
      bookingStatusTransition: {
        create: jest.fn(),
      },
      $executeRaw: jest.fn(),
      location: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'pickup-1', isActive: true }),
      },
    };

    prisma.$transaction.mockImplementation(
      async <TResult>(handler: (client: typeof tx) => Promise<TResult>) =>
        handler(tx),
    );

    const result = await service.createBooking('user-1', {
      ...baseDto,
      idempotencyKey: 'idem-2',
    });

    const paymentCreateMock = tx.payment.create as jest.Mock<
      unknown,
      [{ data: { status: string } }]
    >;
    expect(paymentCreateMock).toHaveBeenCalledTimes(1);
    expect(paymentCreateMock.mock.calls[0]?.[0]).toMatchObject({
      data: {
        status: 'pending',
      },
    });
    expect(result).toEqual(createdBooking);
  });

  it('rejects same-day same-car booking conflicts with a conflict response', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ status: 'active' }),
      },
      booking: {
        findFirst: jest.fn().mockResolvedValue({ id: 'booking-conflict' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      car: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'car-1',
          status: 'available',
          name: 'Sedan',
          transmission: 'automatic',
          year: 2024,
          imageUrl: 'https://example.com/car.png',
          pricePerDay: 100,
        }),
      },
      $executeRaw: jest.fn(),
      location: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'pickup-1', isActive: true }),
      },
    };

    prisma.$transaction.mockImplementation(
      async <TResult>(handler: (client: typeof tx) => Promise<TResult>) =>
        handler(tx),
    );

    try {
      await service.createBooking('user-1', baseDto);
      throw new Error('Expected createBooking to reject with a conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      if (error instanceof ConflictException) {
        expect(error.getStatus()).toBe(409);
        expect(error.getResponse()).toMatchObject({
          message: 'This car is already booked for the selected day.',
        });
      }
    }
  });

  it('allows admins to delete only expired bookings', async () => {
    const deletedBooking = {
      id: 'booking-expired',
      status: 'expired',
      deletedAt: new Date(),
      reviewedByUserId: 'admin-1',
      idempotencyKey: null,
    };

    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-expired',
          status: 'expired',
          deletedAt: null,
        }),
        delete: jest.fn().mockResolvedValue(deletedBooking),
      },
    };

    prisma.$transaction.mockImplementation(
      async <TResult>(handler: (client: typeof tx) => Promise<TResult>) =>
        handler(tx),
    );

    const result = await service.deleteExpiredBooking(
      'admin-1',
      'booking-expired',
    );

    const bookingDeleteMock = tx.booking.delete as jest.Mock<
      unknown,
      [{ where: { id: string } }]
    >;
    expect(bookingDeleteMock).toHaveBeenCalledTimes(1);
    expect(bookingDeleteMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'booking-expired' },
    });
    expect(result).toEqual(deletedBooking);
  });

  it('rejects deleting non-expired bookings', async () => {
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-pending',
          status: 'pending',
          deletedAt: null,
        }),
        update: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async <TResult>(handler: (client: typeof tx) => Promise<TResult>) =>
        handler(tx),
    );

    await expect(
      service.deleteExpiredBooking('admin-1', 'booking-pending'),
    ).rejects.toThrow('Only expired bookings can be deleted by admins');
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it('allows admins to delete cancelled bookings', async () => {
    const deletedBooking = {
      id: 'booking-cancelled',
      status: 'cancelled',
      deletedAt: new Date(),
      reviewedByUserId: 'admin-1',
      idempotencyKey: null,
    };

    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-cancelled',
          status: 'cancelled',
          deletedAt: null,
        }),
        delete: jest.fn().mockResolvedValue(deletedBooking),
      },
    };

    prisma.$transaction.mockImplementation(
      async <TResult>(handler: (client: typeof tx) => Promise<TResult>) =>
        handler(tx),
    );

    const result = await service.deleteCancelledBooking(
      'admin-1',
      'booking-cancelled',
    );

    const cancelledDeleteMock = tx.booking.delete as jest.Mock<
      unknown,
      [{ where: { id: string } }]
    >;
    expect(cancelledDeleteMock).toHaveBeenCalledTimes(1);
    expect(cancelledDeleteMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'booking-cancelled' },
    });
    expect(result).toEqual(deletedBooking);
  });

  it('rejects paid pending bookings and flags manual refund review', async () => {
    const updatedBooking = {
      id: 'booking-paid-pending',
      status: 'rejected',
      rejectedAt: new Date(),
      reviewedByUserId: 'admin-1',
    };

    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-paid-pending',
          status: 'pending',
          carId: 'car-1',
          deletedAt: null,
        }),
        update: jest.fn().mockResolvedValue(updatedBooking),
        count: jest.fn().mockResolvedValue(0),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'payment-1',
            status: 'completed',
            amount: 250,
          },
        ]),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      bookingStatusTransition: {
        create: jest.fn(),
      },
      car: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'available',
        }),
        update: jest.fn(),
      },
      $executeRaw: jest.fn(),
    };

    prisma.$transaction.mockImplementation(
      async <TResult>(handler: (client: typeof tx) => Promise<TResult>) =>
        handler(tx),
    );

    (prisma as any).booking = {
      findUnique: jest.fn().mockResolvedValue(updatedBooking),
    };

    const result = await service.rejectBooking('admin-1', {
      bookingId: 'booking-paid-pending',
      reason: 'Capacity issue',
      refundMode: RefundMode.MANUAL_REVIEW,
    });

    const updateCalls = (tx.payment.update as jest.Mock).mock.calls;

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.[0]).toMatchObject({
      where: { id: 'payment-1' },
      data: {
        refundReason: 'Capacity issue',
        status: 'refunded',
        refundedAmount: 250,
      },
    });
    expect(tx.car.update).toHaveBeenCalledWith({
      where: { id: 'car-1' },
      data: {
        status: 'available',
      },
    });
    expect(result).toEqual(updatedBooking);
  });

  it('rejects paid pending bookings in auto mode without changing completed payment status immediately', async () => {
    const updatedBooking = {
      id: 'booking-paid-pending-auto',
      status: 'rejected',
      rejectedAt: new Date(),
      reviewedByUserId: 'admin-1',
    };

    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-paid-pending-auto',
          status: 'pending',
          carId: 'car-1',
          deletedAt: null,
        }),
        update: jest.fn().mockResolvedValue(updatedBooking),
        count: jest.fn().mockResolvedValue(0),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'payment-1',
            status: 'completed',
            amount: 250,
          },
        ]),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      bookingStatusTransition: {
        create: jest.fn(),
      },
      car: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'available',
        }),
        update: jest.fn(),
      },
      $executeRaw: jest.fn(),
    };

    prisma.$transaction.mockImplementation(
      async <TResult>(handler: (client: typeof tx) => Promise<TResult>) =>
        handler(tx),
    );

    (prisma as any).booking = {
      findUnique: jest.fn().mockResolvedValue(updatedBooking),
    };

    const result = await service.rejectBooking('admin-1', {
      bookingId: 'booking-paid-pending-auto',
      reason: 'Customer request',
      refundMode: RefundMode.AUTO,
    });

    const updateCalls = (tx.payment.update as jest.Mock).mock.calls;

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.[0]).toMatchObject({
      where: { id: 'payment-1' },
      data: {
        refundReason: 'Customer request',
        status: 'refunded',
        refundedAmount: 250,
      },
    });
    expect(result).toEqual(updatedBooking);
  });

  it('does not set refund_reversed when refund initiation cannot start due to missing transaction reference', async () => {
    (prisma as any).booking = {
      findUnique: jest.fn().mockResolvedValue({
        id: 'booking-rejected-auto',
        status: 'rejected',
        deletedAt: null,
      }),
    };

    (prisma as any).payment = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'payment-1',
        },
      ]),
      findUnique: jest.fn().mockResolvedValue({
        id: 'payment-1',
        bookingId: 'booking-rejected-auto',
        transactionId: null,
        amount: 200,
        refundedAmount: 0,
        status: 'completed',
      }),
      update: jest.fn().mockResolvedValue({}),
    };

    const result = await service.processRejectedBookingRefunds({
      bookingId: 'booking-rejected-auto',
      reason: 'Auto refund after rejection',
    });

    expect((prisma as any).payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: expect.objectContaining({
        refundReason: 'Auto refund after rejection',
      }),
    });
    expect(
      (prisma as any).payment.update.mock.calls[0][0].data,
    ).not.toHaveProperty('status');
    expect(result).toMatchObject({
      failed: 1,
      completed: 0,
      queued: 0,
    });
  });

  it('blocks deleting rejected booking before refund completion', async () => {
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-rejected',
          status: 'rejected',
          deletedAt: null,
          payments: [
            {
              status: 'refund_processing',
            },
          ],
        }),
        update: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async <TResult>(handler: (client: typeof tx) => Promise<TResult>) =>
        handler(tx),
    );

    await expect(
      service.deleteRejectedBooking('admin-1', 'booking-rejected'),
    ).rejects.toThrow(
      'Rejected bookings can be deleted only after refund is completed',
    );
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it('cancels unpaid pending bookings manually by admin', async () => {
    const updatedBooking = {
      id: 'booking-pending',
      status: 'cancelled',
      cancelledAt: new Date(),
      reviewedByUserId: 'admin-1',
    };

    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-pending',
          status: 'pending',
          carId: 'car-1',
          deletedAt: null,
        }),
        update: jest.fn().mockResolvedValue(updatedBooking),
        count: jest.fn().mockResolvedValue(0),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([
          {
            status: 'pending',
            amount: 250,
            refundedAmount: 0,
          },
        ]),
        updateMany: jest.fn(),
      },
      bookingStatusTransition: {
        create: jest.fn(),
      },
      car: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'available',
        }),
        update: jest.fn(),
      },
      $executeRaw: jest.fn(),
    };

    prisma.$transaction.mockImplementation(
      async <TResult>(handler: (client: typeof tx) => Promise<TResult>) =>
        handler(tx),
    );

    const result = await service.cancelUnpaidPendingBooking('admin-1', {
      bookingId: 'booking-pending',
      reason: 'No payment after manual review',
    });

    const cancelUnpaidUpdateMock = tx.booking.update as jest.Mock<
      unknown,
      [
        {
          where: { id: string };
          data: {
            status: string;
            reviewedByUserId: string;
            cancellationReason: string;
          };
        },
      ]
    >;
    expect(cancelUnpaidUpdateMock).toHaveBeenCalledTimes(1);
    expect(cancelUnpaidUpdateMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'booking-pending' },
      data: {
        status: 'cancelled',
        reviewedByUserId: 'admin-1',
        cancellationReason: 'No payment after manual review',
      },
    });
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: {
        bookingId: 'booking-pending',
      },
      data: {
        status: 'pending',
        notes: 'Cancelled manually by admin before payment completion',
      },
    });
    expect(tx.car.update).toHaveBeenCalledWith({
      where: { id: 'car-1' },
      data: {
        status: 'available',
      },
    });
    expect(result).toEqual(updatedBooking);
  });

  it('rejects admin manual cancellation when booking is already paid', async () => {
    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-paid',
          status: 'pending',
          carId: 'car-1',
          deletedAt: null,
        }),
        update: jest.fn(),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([
          {
            status: 'completed',
            amount: 350,
            refundedAmount: 0,
          },
        ]),
      },
      location: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'return-1', isActive: false }),
      },
      $executeRaw: jest.fn(),
    };

    prisma.$transaction.mockImplementation(
      async <TResult>(handler: (client: typeof tx) => Promise<TResult>) =>
        handler(tx),
    );

    await expect(
      service.cancelUnpaidPendingBooking('admin-1', {
        bookingId: 'booking-paid',
      }),
    ).rejects.toThrow(
      'Only unpaid pending bookings can be cancelled manually by admins',
    );
    expect(tx.booking.update).not.toHaveBeenCalled();
  });

  it('returns overlap conflicts with overlap conflictType', async () => {
    const pickup = new Date('2026-05-20T10:00:00Z');
    const returnDate = new Date('2026-05-22T10:00:00Z');

    const tx = {
      booking: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'booking-1',
            bookingCode: 'BK-1',
            pickupAt: new Date('2026-05-19T10:00:00Z'),
            returnAt: new Date('2026-05-21T10:00:00Z'),
            status: 'approved',
          },
        ]),
      },
    };

    const conflicts = await (
      service as unknown as {
        findConflicts: (
          client: unknown,
          params: {
            carId: string;
            pickup: Date;
            returnDate: Date;
            excludeBookingId?: string;
          },
        ) => Promise<unknown[]>;
      }
    ).findConflicts(tx, {
      carId: 'car-1',
      pickup,
      returnDate,
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      id: 'booking-1',
      conflictType: 'overlap',
    });
  });

  it('queries overlapping pending, approved, and active bookings', async () => {
    const pickup = new Date('2026-05-20T10:00:00Z');
    const returnDate = new Date('2026-05-22T10:00:00Z');

    const findMany = jest.fn().mockResolvedValue([]);
    const tx = {
      booking: {
        findMany,
      },
    };

    await (
      service as unknown as {
        findConflicts: (
          client: unknown,
          params: {
            carId: string;
            pickup: Date;
            returnDate: Date;
            excludeBookingId?: string;
          },
        ) => Promise<unknown[]>;
      }
    ).findConflicts(tx, {
      carId: 'car-1',
      pickup,
      returnDate,
      excludeBookingId: 'booking-2',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          carId: 'car-1',
          status: { in: ['pending', 'approved', 'active'] },
          pickupAt: { lt: returnDate },
          returnAt: { gt: pickup },
          id: { not: 'booking-2' },
        }),
      }),
    );
  });
});
