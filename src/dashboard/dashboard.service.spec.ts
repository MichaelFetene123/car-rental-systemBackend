import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    payment: { aggregate: jest.Mock; findMany: jest.Mock };
    booking: { count: jest.Mock; findMany: jest.Mock };
    car: { count: jest.Mock; findMany: jest.Mock };
    carCategory: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      payment: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      booking: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      car: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      carCategory: {
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('aggregates revenue from amount, tax, and fees', async () => {
    prisma.car.count.mockResolvedValue(0);
    prisma.booking.count.mockResolvedValue(0);
    prisma.payment.aggregate.mockResolvedValue({
      _sum: { amount: 1000, tax: 150, fees: 50 },
    });
    prisma.payment.findMany.mockResolvedValue([
      {
        amount: 1000,
        tax: 150,
        fees: 50,
        createdAt: new Date('2026-05-01T00:00:00Z'),
      },
      {
        amount: 500,
        tax: 75,
        fees: 25,
        createdAt: new Date('2026-04-01T00:00:00Z'),
      },
    ]);
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.carCategory.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.car.findMany.mockResolvedValue([]);

    const result = await service.getDashboardData();

    expect(result.revenue).toBe(1200);
    expect(result.revenueOverview).toEqual([
      { month: 'Apr 2026', revenue: 600 },
      { month: 'May 2026', revenue: 1200 },
    ]);
  });
});
