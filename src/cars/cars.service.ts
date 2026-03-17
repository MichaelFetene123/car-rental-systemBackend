import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateCarDto } from './dto/createCar.dto';
import { Prisma } from 'src/generated/prisma/client';

// Rest of your code...

@Injectable()
export class CarsService {
  constructor(private prisma: PrismaService) {}

  async createCar(createCarDto: CreateCarDto) {
    const createdCar = await this.prisma.car.create({
      data: {
        name: createCarDto.name,
        year: createCarDto.year,
        seats: createCarDto.seats,
        transmission: createCarDto.transmission,
        pricePerDay: new Prisma.Decimal(createCarDto.pricePerDay),
        status: createCarDto.status ?? 'available',

        ...(createCarDto.categoryId && { categoryId: createCarDto.categoryId }),
        ...(createCarDto.fuelType && { fuelType: createCarDto.fuelType }),
        ...(createCarDto.imageUrl && { imageUrl: createCarDto.imageUrl }),
        ...(createCarDto.description && {
          description: createCarDto.description,
        }),
        ...(createCarDto.homeLocationId && {
          homeLocationId: createCarDto.homeLocationId,
        }),
      },
      include: {
        category: true,
        homeLocation: true,
      },
    });
    return createdCar;
  }
}
