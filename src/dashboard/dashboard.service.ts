// dashboard.service.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingStatus,
  CarStatus,
  PaymentStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getDashboardData(): Promise<DashboardResponseDto> {
    const [
      availableCars,
      activeRentals,
      totalBookings,
      revenue,
      revenueOverview,
      weeklyBookings,
      fleetDistribution,
      recentActivity,
    ] = await Promise.all([
      this.getAvailableCars(),
      this.getActiveRentals(),
      this.getTotalBookings(),
      this.getRevenue(),
      this.getRevenueOverview(),
      this.getWeeklyBookings(),
      this.getFleetDistribution(),
      this.getRecentActivity(),
    ]);

    return {
      availableCars,
      activeRentals,
      totalBookings,
      revenue,
      revenueOverview,
      weeklyBookings,
      fleetDistribution,
      recentActivity,
    };
  }

  // ================= KPI =================

  private async getAvailableCars(): Promise<number> {
    return this.prisma.car.count({
      where: { status: CarStatus.available },
    });
  }

  private async getActiveRentals(): Promise<number> {
    return this.prisma.booking.count({
      where: { status: BookingStatus.active },
    });
  }

  private async getTotalBookings(): Promise<number> {
    return this.prisma.booking.count();
  }

  private async getRevenue(): Promise<number> {
    const result = await this.prisma.payment.aggregate({
      _sum: {
        amount: true,
        tax: true,
        fees: true,
      },
      where: { status: PaymentStatus.completed },
    });

    return Number(result._sum?.amount ?? 0)
      + Number(result._sum?.tax ?? 0)
      + Number(result._sum?.fees ?? 0);
  }

  // ================= CHARTS =================

  private async getRevenueOverview() {
    /**
     * NOTE:
     * Prisma does not support DATE_TRUNC directly.
     * This is in-memory aggregation (acceptable for MVP).
     */

    const payments = await this.prisma.payment.findMany({
      where: { status: PaymentStatus.completed },
      select: { amount: true, tax: true, fees: true, createdAt: true },
    });

    const map = new Map<
      string,
      { order: number; label: string; revenue: number }
    >();

    for (const p of payments) {
      const date = new Date(p.createdAt);
      const order = date.getFullYear() * 100 + date.getMonth() + 1;
      const label = date.toLocaleString('default', {
        month: 'short',
        year: 'numeric',
      });
      const revenue =
        Number(p.amount) + Number(p.tax ?? 0) + Number(p.fees ?? 0);

      const existing = map.get(label);
      if (existing) {
        existing.revenue += revenue;
        continue;
      }

      map.set(label, { order, label, revenue });
    }

    return Array.from(map.values())
      .sort((a, b) => a.order - b.order)
      .map(({ label, revenue }) => ({
        month: label,
        revenue,
      }));
  }

  private async getWeeklyBookings() {
    const bookings = await this.prisma.booking.findMany({
      select: { bookedAt: true },
    });

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const map = new Map<string, number>(days.map((d) => [d, 0]));

    for (const b of bookings) {
      const day = days[new Date(b.bookedAt).getDay()];
      map.set(day, (map.get(day) || 0) + 1);
    }

    return Array.from(map.entries()).map(([day, count]) => ({
      day,
      count,
    }));
  }

  // ================= PIE =================

  private async getFleetDistribution() {
    const categories = await this.prisma.carCategory.findMany({
      select: {
        name: true,
        _count: {
          select: { cars: true },
        },
      },
    });

    return categories.map((category) => ({
      type: category.name,
      count: category._count.cars,
    }));
  }

  // ================= ACTIVITY =================

  private async getRecentActivity() {
    const [bookings, users, payments, cars] = await Promise.all([
      this.prisma.booking.findMany({
        take: 5,
        orderBy: { bookedAt: 'desc' },
        select: {
          bookedAt: true,
          carNameSnapshot: true,
          car: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prisma.user.findMany({
        take: 20,
        orderBy: { created_at: 'desc' },
        select: { created_at: true },
      }),
      this.prisma.payment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          amount: true,
          createdAt: true,
        },
      }),
      this.prisma.car.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const currencyCode = this.config.get<string>('CURRENCY_CODE') ?? 'ETB';
    const currencyFormatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const usersLast24h = users.filter((u) => u.created_at >= oneDayAgo).length;
    const userMessage =
      usersLast24h > 1
        ? `${usersLast24h} new users registered`
        : 'New user registered';

    const userActivity = users[0]
      ? [
          {
            type: 'user' as const,
            message: userMessage,
            createdAt: users[0].created_at,
          },
        ]
      : [];

    const activity = [
      ...bookings.map((b) => ({
        type: 'booking' as const,
        message: `New booking for ${b.carNameSnapshot || b.car.name}`,
        createdAt: b.bookedAt,
      })),
      ...userActivity,
      ...payments.map((p) => ({
        type: 'payment' as const,
        message: `Payment of ${currencyFormatter.format(Number(p.amount))} received`,
        createdAt: p.createdAt,
      })),
      ...cars.map((c) => ({
        type: 'car' as const,
        message: 'New car added',
        createdAt: c.createdAt,
      })),
    ];

    return activity
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 5);
  }
}
