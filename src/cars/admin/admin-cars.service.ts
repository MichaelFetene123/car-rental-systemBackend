import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateCarDto } from '../dto/createCar.dto';
import { UpdateCarDto } from '../dto/updateCar.dto';
import { Prisma } from 'src/generated/prisma/client';

@Injectable()
export class AdminCarsService {
  constructor(private prisma: PrismaService) {}

  private async validateCategory(id?: string) {
    if (!id) return;
    const category = await this.prisma.carCategory.findUnique({
      where: { id },
    });
    if (!category)
      throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
  }

  private async validateLocation(id?: string) {
    if (!id) return;
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location)
      throw new HttpException('Location not found', HttpStatus.NOT_FOUND);
  }

  async createCar(dto: CreateCarDto) {
    await this.validateCategory(dto.categoryId);
    await this.validateLocation(dto.homeLocationId);

    return this.prisma.car.create({
      data: {
        name: dto.name,
        year: dto.year,
        seats: dto.seats,
        transmission: dto.transmission,
        pricePerDay: new Prisma.Decimal(dto.pricePerDay),
        status: dto.status ?? 'available',
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.fuelType && { fuelType: dto.fuelType }),
        ...(dto.imageUrl && { imageUrl: dto.imageUrl }),
        ...(dto.description && { description: dto.description }),
        ...(dto.homeLocationId && { homeLocationId: dto.homeLocationId }),
      },
      include: { category: true, homeLocation: true },
    });
  }

  async updateCar(id: string, dto: UpdateCarDto) {
    const existingCar = await this.prisma.car.findUnique({ where: { id } });
    if (!existingCar)
      throw new HttpException('Car not found', HttpStatus.NOT_FOUND);

    await this.validateCategory(dto.categoryId);
    await this.validateLocation(dto.homeLocationId);

    return this.prisma.car.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.year && { year: dto.year }),
        ...(dto.seats && { seats: dto.seats }),
        ...(dto.transmission && { transmission: dto.transmission }),
        ...(dto.pricePerDay !== undefined && {
          pricePerDay: new Prisma.Decimal(dto.pricePerDay),
        }),
        ...(dto.status && { status: dto.status }),
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.fuelType && { fuelType: dto.fuelType }),
        ...(dto.imageUrl && { imageUrl: dto.imageUrl }),
        ...(dto.description && { description: dto.description }),
        ...(dto.homeLocationId && { homeLocationId: dto.homeLocationId }),
      },
    });
  }

  async deleteCar(id: string) {
    const existingCar = await this.prisma.car.findUnique({ where: { id } });
    if (!existingCar)
      throw new HttpException('Car not found', HttpStatus.NOT_FOUND);

    await this.prisma.car.delete({ where: { id } });
    return { message: 'Car deleted successfully' };
  }

  async getAllCars() {
    return this.prisma.car.findMany({
      include: { category: true, homeLocation: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
