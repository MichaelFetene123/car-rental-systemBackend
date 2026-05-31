import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { PrismaService } from '../prisma.service';

describe('LocationsService', () => {
  let service: LocationsService;
  let prisma: {
    location: {
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    car: {
      count: jest.Mock;
    };
    booking: {
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      location: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      car: {
        count: jest.fn(),
      },
      booking: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('blocks deactivation and returns accurate active dependency counts', async () => {
    prisma.booking.count
      .mockResolvedValueOnce(2) // approved
      .mockResolvedValueOnce(1) // pending
      .mockResolvedValueOnce(3); // active
    prisma.car.count.mockResolvedValue(4); // available/rented

    await expect(service.toggleStatus('location-1', false)).rejects.toMatchObject(
      {
        response: {
          message:
            'Cannot deactivate location. Resolve active dependencies first.',
          dependencies: {
            activeBookings: 2,
            pendingBookings: 1,
            ongoingRentals: 3,
            activeVehicles: 4,
          },
          totalDependencies: 10,
        },
      },
    );

    expect(prisma.booking.count).toHaveBeenNthCalledWith(1, {
      where: {
        deletedAt: null,
        status: 'approved',
        OR: [{ pickupLocationId: 'location-1' }, { returnLocationId: 'location-1' }],
      },
    });
    expect(prisma.booking.count).toHaveBeenNthCalledWith(2, {
      where: {
        deletedAt: null,
        status: 'pending',
        OR: [{ pickupLocationId: 'location-1' }, { returnLocationId: 'location-1' }],
      },
    });
    expect(prisma.booking.count).toHaveBeenNthCalledWith(3, {
      where: {
        deletedAt: null,
        status: 'active',
        OR: [{ pickupLocationId: 'location-1' }, { returnLocationId: 'location-1' }],
      },
    });
    expect(prisma.car.count).toHaveBeenCalledWith({
      where: {
        homeLocationId: 'location-1',
        status: { in: ['rented'] },
      },
    });
  });

  it('allows deactivation when there are no active dependencies', async () => {
    prisma.booking.count.mockResolvedValue(0);
    prisma.car.count.mockResolvedValue(0);
    prisma.location.update.mockResolvedValue({
      id: 'location-1',
      isActive: false,
    });

    const result = await service.toggleStatus('location-1', false);

    expect(result).toEqual({ id: 'location-1', isActive: false });
    expect(prisma.location.update).toHaveBeenCalledWith({
      where: { id: 'location-1' },
      data: { isActive: false },
    });
  });
});
