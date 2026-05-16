import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { BookingStatus } from '../generated/prisma/client';

@Injectable()
export class CarsService {
  constructor(private prisma: PrismaService) {}

  async getAllCars() {
    const cars = await this.prisma.car.findMany({
      include: { category: true, homeLocation: true },
      orderBy: { createdAt: 'desc' },
    });

    if (cars.length === 0) return cars;

    const carIds = cars.map((car) => car.id);
    const unavailableMap = await this.getUnavailablePeriodsByCarId(carIds);

    return cars.map((car) => ({
      ...car,
      unavailablePeriod: unavailableMap.get(car.id) ?? null,
    }));
  }

  async getCarById(id: string) {
    const car = await this.prisma.car.findUnique({
      where: { id },
      include: { category: true, homeLocation: true },
    });

    if (!car) throw new HttpException('Car not found', HttpStatus.NOT_FOUND);

    const unavailableMap = await this.getUnavailablePeriodsByCarId([car.id]);

    return {
      ...car,
      unavailablePeriod: unavailableMap.get(car.id) ?? null,
    };
  }

  private startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private diffDays(start: Date, end: Date) {
    const dayInMs = 1000 * 60 * 60 * 24;
    const startMs = this.startOfDay(start).getTime();
    const endMs = this.startOfDay(end).getTime();
    return Math.max(0, Math.round((endMs - startMs) / dayInMs));
  }

  private mergeUnavailablePeriods(ranges: Array<{ start: Date; end: Date }>) {
    if (ranges.length === 0) return [];

    const sorted = [...ranges].sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    );

    const merged: Array<{ start: Date; end: Date }> = [
      { start: sorted[0].start, end: sorted[0].end },
    ];

    for (const range of sorted.slice(1)) {
      const current = merged[merged.length - 1];

      if (range.start.getTime() <= current.end.getTime()) {
        if (range.end.getTime() > current.end.getTime()) {
          current.end = range.end;
        }
        continue;
      }

      merged.push({ start: range.start, end: range.end });
    }

    return merged;
  }

  private async getUnavailablePeriodsByCarId(carIds: string[]) {
    const todayStart = this.startOfDay(new Date());
    const activeStatuses: BookingStatus[] = ['approved', 'active'];

    const bookings = await this.prisma.booking.findMany({
      where: {
        carId: { in: carIds },
        status: { in: activeStatuses },
        returnAt: { gte: todayStart },
      },
      select: {
        carId: true,
        pickupAt: true,
        returnAt: true,
      },
      orderBy: { pickupAt: 'asc' },
    });

    const grouped = new Map<string, Array<{ start: Date; end: Date }>>();

    for (const booking of bookings) {
      const list = grouped.get(booking.carId) ?? [];
      list.push({
        start: this.startOfDay(booking.pickupAt),
        end: this.startOfDay(booking.returnAt),
      });
      grouped.set(booking.carId, list);
    }

    const result = new Map<
      string,
      { startDate: Date; endDate: Date; days: number }
    >();

    for (const [carId, ranges] of grouped.entries()) {
      const merged = this.mergeUnavailablePeriods(ranges);
      const current = merged.find(
        (range) =>
          todayStart.getTime() >= range.start.getTime() &&
          todayStart.getTime() <= range.end.getTime(),
      );

      if (current) {
        result.set(carId, {
          startDate: current.start,
          endDate: current.end,
          days: this.diffDays(current.start, current.end),
        });
      }
    }

    return result;
  }
}
