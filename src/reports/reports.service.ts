import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { QueryReportDto, ReportType } from './dto/query-report.dto';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private getDateFilter(query: QueryReportDto) {
    return {
      gte: query.startDate ? new Date(query.startDate) : undefined,
      lte: query.endDate ? new Date(query.endDate) : undefined,
    };
  }

  // =========================
  // 1. SUMMARY (KPI CARDS)
  // =========================
  async getSummary(query: QueryReportDto) {
    const dateFilter = this.getDateFilter(query);

    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'completed',
        paidAt: dateFilter,
      },
    });

    let totalRevenue = 0;

    for (const p of payments) {
      totalRevenue += Number(p.amount) + Number(p.tax) + Number(p.fees);
    }

    const totalBookings = await this.prisma.booking.count({
      where: {
        bookedAt: dateFilter,
      },
    });

    const days =
      query.startDate && query.endDate
        ? Math.ceil(
            (new Date(query.endDate).getTime() -
              new Date(query.startDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1 // ← Add +1 to make it truly inclusive
        : 1;

    return {
      totalRevenue,
      totalBookings,
      avgDailyRevenue: totalRevenue / (days || 1),
    };
  }

  // =========================
  // 2. TREND (DAILY/MONTHLY)
  // =========================
  async getTrend(query: QueryReportDto) {
    const dateFilter = this.getDateFilter(query);

    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'completed',
        paidAt: dateFilter,
      },
      select: {
        paidAt: true,
        amount: true,
        tax: true,
        fees: true,
      },
    });

    const map = new Map<string, number>();

    for (const p of payments) {
      const date = new Date(p.paidAt!);

      let key: string;

      if (query.type === ReportType.MONTHLY) {
        key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      } else {
        key = date.toISOString().split('T')[0];
      }

      const revenue = Number(p.amount) + Number(p.tax) + Number(p.fees);

      map.set(key, (map.get(key) || 0) + revenue);
    }

    return Array.from(map.entries()).map(([period, revenue]) => ({
      period,
      revenue,
    }));
  }

  // =========================
  // 3. REVENUE BY CATEGORY
  // =========================
  async getRevenueByCategory(query: QueryReportDto) {
    const dateFilter = this.getDateFilter(query);

    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'completed',
        paidAt: dateFilter,
      },
      include: {
        booking: {
          include: {
            car: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    const map = new Map<string, number>();

    for (const p of payments) {
      const category = p.booking.car.category?.name || 'Unknown';

      const revenue = Number(p.amount) + Number(p.tax) + Number(p.fees);

      map.set(category, (map.get(category) || 0) + revenue);
    }

    return Array.from(map.entries()).map(([category, revenue]) => ({
      category,
      revenue,
    }));
  }

  // =========================
  // 4. TOP PERFORMING (REVENUE)
  // =========================
  async getTopCategories(query: QueryReportDto) {
    const data = await this.getRevenueByCategory(query);

    return data.sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }

  // =========================
  // 5. MOST BOOKED
  // =========================
  async getMostBooked(query: QueryReportDto) {
    const dateFilter = this.getDateFilter(query);

    const bookings = await this.prisma.booking.findMany({
      where: {
        bookedAt: dateFilter,
      },
      include: {
        car: {
          include: {
            category: true,
          },
        },
      },
    });

    const map = new Map<string, number>();

    for (const b of bookings) {
      const category = b.car.category?.name || 'Unknown';

      map.set(category, (map.get(category) || 0) + 1);
    }

    return Array.from(map.entries())
      .map(([category, bookings]) => ({
        category,
        bookings,
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5);
  }
}
