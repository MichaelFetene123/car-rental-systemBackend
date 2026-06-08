import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
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
    
    const map = new Map<
      string,
      { period: string; revenue: number; bookings: number; cars: number }
    >();

    const getPeriodKey = (date: Date) => {
      if (query.type === ReportType.MONTHLY) {
        // e.g. 2026-05 for May 2026 or just May
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      } else {
        return date.toISOString().split('T')[0];
      }
    };

    // 1. Revenue
    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'completed',
        paidAt: dateFilter,
      },
    });

    for (const p of payments) {
      if (!p.paidAt) continue;
      const key = getPeriodKey(new Date(p.paidAt));
      const revenue = Number(p.amount) + Number(p.tax) + Number(p.fees);

      if (!map.has(key)) {
        map.set(key, { period: key, revenue: 0, bookings: 0, cars: 0 });
      }
      map.get(key)!.revenue += revenue;
    }

    // 2. Bookings & Cars
    const bookings = await this.prisma.booking.findMany({
      where: { bookedAt: dateFilter },
      select: { bookedAt: true, carId: true },
    });

    const carSets = new Map<string, Set<string>>();

    for (const b of bookings) {
      const key = getPeriodKey(new Date(b.bookedAt));
      if (!map.has(key)) {
        map.set(key, { period: key, revenue: 0, bookings: 0, cars: 0 });
      }
      map.get(key)!.bookings += 1;

      if (!carSets.has(key)) carSets.set(key, new Set());
      carSets.get(key)!.add(b.carId);
    }

    for (const [key, value] of map.entries()) {
      value.cars = carSets.get(key)?.size || 0;
    }

    const sortableFormat = (periodStr: string) => {
      if (query.type === ReportType.MONTHLY) {
        return new Date(periodStr).getTime();
      }
      return new Date(periodStr).getTime();
    };

    return Array.from(map.values()).sort(
      (a, b) => sortableFormat(a.period) - sortableFormat(b.period),
    );
  }

  // =========================
  // 3. REVENUE & BOOKINGS BY CATEGORY
  // =========================
  async getRevenueByCategory(query: QueryReportDto) {
    const dateFilter = this.getDateFilter(query);

    const map = new Map<
      string,
      { category: string; revenue: number; bookings: number }
    >();

    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'completed',
        paidAt: dateFilter,
      },
      include: {
        booking: {
          include: { car: { include: { category: true } } },
        },
      },
    });

    for (const p of payments) {
      const category = p.booking.car.category?.name || 'Unknown';
      const revenue = Number(p.amount) + Number(p.tax) + Number(p.fees);

      if (!map.has(category)) {
        map.set(category, { category, revenue: 0, bookings: 0 });
      }
      map.get(category)!.revenue += revenue;
    }

    const bookings = await this.prisma.booking.findMany({
      where: { bookedAt: dateFilter },
      include: { car: { include: { category: true } } },
    });

    for (const b of bookings) {
      const category = b.car.category?.name || 'Unknown';
      if (!map.has(category)) {
        map.set(category, { category, revenue: 0, bookings: 0 });
      }
      map.get(category)!.bookings += 1;
    }

    return Array.from(map.values());
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
    const data = await this.getRevenueByCategory(query);
    return data.sort((a, b) => b.bookings - a.bookings).slice(0, 5);
  }
}
