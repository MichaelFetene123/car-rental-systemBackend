import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateCarDto } from '../dto/createCar.dto';
import { UpdateCarDto } from '../dto/updateCar.dto';
import { Prisma } from '../../generated/prisma/client';

// for image 
import * as fs from 'fs';
import * as path from 'path';

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

  async createCar(dto: CreateCarDto, file?: Express.Multer.File) {
    await this.validateCategory(dto.categoryId);
    await this.validateLocation(dto.homeLocationId);

    let imageUrl: string | undefined;

    if (file) {
      imageUrl = `/uploads/${file.filename}`;
    }

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
        ...(dto.description && { description: dto.description }),
        ...(dto.homeLocationId && { homeLocationId: dto.homeLocationId }),

        ...(imageUrl && { imageUrl }),
      },
      include: { category: true, homeLocation: true },
    });
  }

  async updateCar(id: string, dto: UpdateCarDto, file?: Express.Multer.File) {
    const existingCar = await this.prisma.car.findUnique({ where: { id } });
    if (!existingCar)
      throw new HttpException('Car not found', HttpStatus.NOT_FOUND);

    await this.validateCategory(dto.categoryId);
    await this.validateLocation(dto.homeLocationId);

// image upload process
     let imageUrl: string | undefined;

  if (file) {
    imageUrl = `/uploads/${file.filename}`;

    // 🔥 delete old image (important)
    if (existingCar.imageUrl) {
      const oldPath = path.join('.', existingCar.imageUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
  }


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
        ...(dto.description && { description: dto.description }),
        ...(dto.homeLocationId && { homeLocationId: dto.homeLocationId }),

        ...(imageUrl && { imageUrl }), // ✅ update only if new file
      },
    });
  }

  async deleteCar(id: string) {
    const existingCar = await this.prisma.car.findUnique({ where: { id } });
    if (!existingCar)
      throw new HttpException('Car not found', HttpStatus.NOT_FOUND);

    
  if (existingCar.imageUrl) {
    const filePath = `.${existingCar.imageUrl}`;
    const fs = require('fs');

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

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
