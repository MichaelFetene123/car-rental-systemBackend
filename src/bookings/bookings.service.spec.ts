import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma.service';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: PrismaService;

  const baseDto = {
    carId: 'car-1',
    pickupLocationId: 'pickup-1',
    returnLocationId: 'return-1',
    pickupAt: '2026-05-01T10:00:00.000Z',
    returnAt: '2026-05-05T10:00:00.000Z',
  };

  const car = {
    id: 'car-1',
    name: 'Sedan',
    transmission: 'auto',
    year: 2022,
    imageUrl: 'https://example.com/car.png',
    pricePerDay: 100,
  };

  const makeTx = () => ({
    booking: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    car: {
      findUnique: jest.fn(),
    },
    $executeRaw: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('returns existing booking for idempotency key', async () => {
    const tx = makeTx();
    const existing = { id: 'booking-1', bookingCode: 'BK-1' };

    tx.booking.findFirst.mockResolvedValueOnce(existing);

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (handler: (client: typeof tx) => Promise<unknown>) => handler(tx),
    );

    const result = await service.createBooking('user-1', {
      ...baseDto,
      idempotencyKey: 'req-1',
    });

    expect(result).toEqual(existing);
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it('rejects overlapping booking', async () => {
    const tx = makeTx();

    tx.car.findUnique.mockResolvedValueOnce(car);
    tx.booking.findFirst.mockResolvedValueOnce({ id: 'conflict' });

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (handler: (client: typeof tx) => Promise<unknown>) => handler(tx),
    );

    await expect(service.createBooking('user-1', baseDto)).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.booking.create).not.toHaveBeenCalled();
  });

  it('creates booking when no overlap', async () => {
    const tx = makeTx();
    const created = { id: 'booking-2', bookingCode: 'BK-2' };

    tx.car.findUnique.mockResolvedValueOnce(car);
    tx.booking.findFirst.mockResolvedValueOnce(null);
    tx.booking.create.mockResolvedValueOnce(created);

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (handler: (client: typeof tx) => Promise<unknown>) => handler(tx),
    );

    const result = await service.createBooking('user-1', {
      ...baseDto,
      idempotencyKey: 'req-2',
    });

    expect(result).toEqual(created);
    expect(tx.booking.create).toHaveBeenCalledTimes(1);
    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ idempotencyKey: 'req-2' }),
      }),
    );
  });
});
