import { Test, TestingModule } from '@nestjs/testing';
import { CarsService } from './cars.service';
import { PrismaService } from '../prisma.service';

describe('CarsService', () => {
  let service: CarsService;
  const prismaMock = {
    car: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<CarsService>(CarsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('filters out cars in inactive categories from public listings', async () => {
    prismaMock.car.findMany = jest.fn().mockResolvedValue([]);
    prismaMock.booking.findMany = jest.fn().mockResolvedValue([]);

    await service.getAllCars();

    expect(prismaMock.car.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                { homeLocation: null },
                { homeLocation: { isActive: true } },
              ]),
            }),
            expect.objectContaining({
              OR: expect.arrayContaining([
                { category: null },
                { category: { isActive: true } },
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it('returns a car even when its home location is inactive', async () => {
    prismaMock.car.findUnique = jest.fn().mockResolvedValue({
      id: 'car-1',
      name: 'Tesla Model 3',
      year: 2024,
      seats: 5,
      fuelType: 'Electric',
      transmission: 'Automatic',
      pricePerDay: '99.00',
      imageUrl: null,
      status: 'available',
      category: { name: 'Electric', isActive: true },
      homeLocation: { id: 'loc-1', name: 'Downtown', isActive: false },
    });
    prismaMock.booking.findMany = jest.fn().mockResolvedValue([]);

    await expect(service.getCarById('car-1')).resolves.toMatchObject({
      id: 'car-1',
      homeLocation: {
        id: 'loc-1',
        name: 'Downtown',
        isActive: false,
      },
      unavailablePeriod: null,
    });
  });
});
