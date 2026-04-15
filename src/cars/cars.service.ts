import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CarsService {
  constructor(private prisma: PrismaService) {}

  async getAllCars() {
    return this.prisma.car.findMany({
      where: { status: 'available' },
      include: { category: true, homeLocation: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCarById(id: string) {
    const car = await this.prisma.car.findUnique({
      where: { id },
      include: { category: true, homeLocation: true },
    });

    if (!car) throw new HttpException('Car not found', HttpStatus.NOT_FOUND);

    return car;
  }
}
